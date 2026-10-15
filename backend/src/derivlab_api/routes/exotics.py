"""Exotic option and American-by-simulation endpoints."""

import math
import time
from collections.abc import Callable

import numpy as np
from fastapi import APIRouter

from derivlab import (
    American,
    AnalyticEngine,
    AsianOption,
    BarrierOption,
    BinomialEngine,
    BlackScholes,
    CosEngine,
    European,
    FiniteDifferenceEngine,
    LookbackOption,
    MonteCarloEngine,
    PlainVanilla,
    PricingEngine,
    PricingResult,
    UnsupportedError,
    VanillaOption,
)
from derivlab.engines.montecarlo import longstaff_schwartz, simulate_paths
from derivlab.engines.pde import solve_pde
from derivlab.instruments import Exotic
from derivlab.market import Market
from derivlab.models import Model
from derivlab.risk import bump_greeks

from ..schemas import GreeksOut
from ..schemas.exotics import (
    AmericanMCRequest,
    AmericanMCResponse,
    ExoticMethod,
    ExoticPathsResponse,
    ExoticPriceResponse,
    ExoticProfileResponse,
    ExoticRequest,
)

router = APIRouter(prefix="/exotics", tags=["exotics"])

PATHS_TO_DRAW = 40


def _equivalent_vanilla(option: Exotic, spot: float) -> VanillaOption:
    """The plain European option to compare an exotic with (floating strikes use spot)."""
    strike = getattr(option, "strike", spot)
    if getattr(option, "strike_type", "fixed") == "floating":
        strike = spot
    return VanillaOption(PlainVanilla(option.kind, strike), European(option.expiry))


def _vanilla_value(option: VanillaOption, market: Market, model: Model) -> float | None:
    engine: PricingEngine = AnalyticEngine() if isinstance(model, BlackScholes) else CosEngine()
    try:
        return engine.price(option, market, model).value
    except (UnsupportedError, ValueError):
        return None


def _run(
    method, label: str, fn: Callable[[], PricingResult]
) -> tuple[ExoticMethod, PricingResult | None]:
    start = time.perf_counter()
    try:
        result = fn()
    except UnsupportedError as e:
        return ExoticMethod(method=method, label=label, status="unsupported", note=str(e)), None
    except ValueError as e:
        return ExoticMethod(method=method, label=label, status="error", note=str(e)), None
    ci = result.confidence_interval()
    note = result.diagnostics.get("monitoring") or result.diagnostics.get("control_variate")
    return (
        ExoticMethod(
            method=method,
            label=label,
            status="ok",
            value=result.value,
            stderr=result.stderr,
            ci_low=ci[0] if ci else None,
            ci_high=ci[1] if ci else None,
            runtime_ms=(time.perf_counter() - start) * 1000,
            note=str(note) if note else None,
        ),
        result,
    )


def _deterministic_engine(
    option: Exotic, market: Market, model: Model
) -> tuple[PricingEngine, str] | None:
    """A smooth (non-random) engine for this product, if one exists."""
    for engine, label in (
        (AnalyticEngine(), "Closed form"),
        (FiniteDifferenceEngine(400, 200, greeks=False), "PDE"),
    ):
        try:
            engine.price(option, market, model)
            return engine, label
        except UnsupportedError:
            continue
    return None


@router.post("/price")
def price(req: ExoticRequest) -> ExoticPriceResponse:
    option, market, model = req.product.build(), req.market, req.model.build()
    pde = FiniteDifferenceEngine(400, 200, greeks=False)
    mc = MonteCarloEngine(paths=req.mc_paths, seed=req.seed)
    runs = [
        _run("analytic", "Closed form", lambda: AnalyticEngine().price(option, market, model)),
        _run("pde", pde.label, lambda: pde.price(option, market, model)),
        _run(
            "monte_carlo",
            f"Monte Carlo · {req.mc_paths:,} paths",
            lambda: mc.price(option, market, model),
        ),
    ]
    best = next((m for m, r in runs if r is not None), None)
    if best is None or best.value is None:
        raise ValueError("no method could price this product")

    greeks, greeks_label = None, None
    if isinstance(model, BlackScholes):
        found = _deterministic_engine(option, market, model)
        engine, label = (
            found
            if found
            else (
                MonteCarloEngine(paths=20_000, seed=req.seed, greeks=False),
                "Monte Carlo (common random numbers)",
            )
        )
        greeks = GreeksOut.of(bump_greeks(engine, option, market, model))
        greeks_label = f"{label}, bump and revalue"

    return ExoticPriceResponse(
        value=best.value,
        value_label=best.label,
        vanilla_value=_vanilla_value(_equivalent_vanilla(option, req.spot), market, model),
        greeks=greeks,
        greeks_label=greeks_label,
        methods=[m for m, _ in runs],
    )


@router.post("/profile")
def profile(req: ExoticRequest) -> ExoticProfileResponse:
    option, market, model = req.product.build(), req.market, req.model.build()
    found = _deterministic_engine(option, market, model)
    if found:
        engine, label, n = found[0], found[1], 61
    else:
        engine, label, n = (
            MonteCarloEngine(paths=10_000, seed=req.seed, greeks=False),
            "Monte Carlo · 10,000 paths (same random numbers at every spot)",
            25,
        )
    spots = np.linspace(0.5 * req.spot, 1.5 * req.spot, n)
    values = np.array(
        [
            engine.price(option, Market(float(s), req.rate, req.dividend_yield), model).value
            for s in spots
        ]
    )
    vanilla = _equivalent_vanilla(option, req.spot)
    vanilla_values = [
        _vanilla_value(vanilla, Market(float(s), req.rate, req.dividend_yield), model)
        for s in spots
    ]
    has_vanilla = all(v is not None for v in vanilla_values)
    vv = np.array(vanilla_values, dtype=float) if has_vanilla else None
    return ExoticProfileResponse(
        engine_label=label,
        spots=spots.tolist(),
        value=values.tolist(),
        delta=np.gradient(values, spots).tolist(),
        vanilla_value=vv.tolist() if vv is not None else None,
        vanilla_delta=np.gradient(vv, spots).tolist() if vv is not None else None,
    )


@router.post("/paths")
def paths(req: ExoticRequest) -> ExoticPathsResponse:
    option, market, model = req.product.build(), req.market, req.model.build()
    t = option.expiry
    if isinstance(option, AsianOption):
        steps = option.fixings * max(1, math.ceil(120 / option.fixings))
    elif isinstance(option, BarrierOption | LookbackOption) and option.observations is not None:
        steps = option.observations * max(1, math.ceil(120 / option.observations))
    else:
        steps = 126
    times = np.linspace(0.0, t, steps + 1)
    rng = np.random.default_rng(req.seed)
    sample = simulate_paths(market, model, t, steps, PATHS_TO_DRAW, rng, antithetic=False)
    payoffs = option.payoff_paths(sample, times)
    hit = option.hit_on_grid(sample).tolist() if isinstance(option, BarrierOption) else None
    fixing_times = averages = extremes = None
    if isinstance(option, AsianOption):
        fixing_times = option.fixing_times().tolist()
        averages = option.average(sample).tolist()
    if isinstance(option, LookbackOption):
        use_max = (option.strike_type == "floating") == (option.kind == "put")
        running = (
            np.maximum.accumulate(sample, axis=1)
            if use_max
            else np.minimum.accumulate(sample, axis=1)
        )
        extremes = running.tolist()
    return ExoticPathsResponse(
        times=times.tolist(),
        paths=sample.tolist(),
        payoffs=payoffs.tolist(),
        hit=hit,
        fixing_times=fixing_times,
        averages=averages,
        extremes=extremes,
    )


@router.post("/american")
def american(req: AmericanMCRequest) -> AmericanMCResponse:
    start = time.perf_counter()
    model = req.model.build()
    market = Market(req.spot, req.rate, req.dividend_yield)
    option = VanillaOption(PlainVanilla(req.kind, req.strike), American(req.expiry))
    european = VanillaOption(PlainVanilla(req.kind, req.strike), European(req.expiry))
    result = longstaff_schwartz(option, market, model, req.paths, req.exercise_dates, req.degree)

    reference_value = reference_label = None
    ref_times: list[float] = []
    ref_boundary: list[float | None] = []
    if isinstance(model, BlackScholes):
        tree = BinomialEngine(2001, "leisen-reimer", greeks=False)
        reference_value = tree.price(option, market, model).value
        reference_label = tree.label
        *_, grid = solve_pde(option, market, model, 400, 200, keep_grid=True)
        assert grid is not None
        for i in range(1, len(grid.taus), 4):
            exercised = grid.exercised[i]
            ref_times.append(float(req.expiry - grid.taus[i]))
            if not exercised.any():
                ref_boundary.append(None)
            else:
                spots = grid.spots[exercised]
                ref_boundary.append(float(spots.max() if req.kind == "put" else spots.min()))

    convergence = []
    for n in (2_000, 5_000, 10_000, 20_000, 50_000, 100_000):
        if n > req.paths:
            break
        r = longstaff_schwartz(option, market, model, n, req.exercise_dates, req.degree, seed=7 + n)
        convergence.append({"paths": float(n), "value": r.value, "stderr": r.stderr})

    def clean(values: np.ndarray) -> list[float | None]:
        return [None if not np.isfinite(v) else float(v) for v in values]

    return AmericanMCResponse(
        lsm_value=result.value,
        lsm_stderr=result.stderr,
        reference_value=reference_value,
        reference_label=reference_label,
        european_value=_vanilla_value(european, market, model) or 0.0,
        exercise_times=result.times.tolist(),
        lsm_boundary=clean(result.boundary),
        reference_times=ref_times,
        reference_boundary=ref_boundary,
        exercise_points=result.exercise_points.tolist(),
        convergence=convergence,
        runtime_ms=(time.perf_counter() - start) * 1000,
    )
