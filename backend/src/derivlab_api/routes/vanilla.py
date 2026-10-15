"""Vanilla option endpoints."""

import math
import time
from collections.abc import Callable

import numpy as np
from fastapi import APIRouter

from derivlab import (
    AnalyticEngine,
    BinomialEngine,
    BlackScholes,
    FiniteDifferenceEngine,
    MonteCarloEngine,
    PricingEngine,
    PricingResult,
    UnsupportedError,
)
from derivlab.calibration import implied_volatility, price_bounds
from derivlab.engines.lattice import tree_nodes
from derivlab.engines.pde import solve_pde
from derivlab.research import (
    REFERENCE_LABEL_AMERICAN,
    REFERENCE_LABEL_EUROPEAN,
    lattice_convergence,
    monte_carlo_convergence,
    pde_convergence,
    reference_value,
    spot_profile,
)

from ..schemas import (
    ConvergencePointOut,
    ConvergenceResponse,
    GreeksOut,
    ImpliedVolRequest,
    ImpliedVolResponse,
    MethodResult,
    MonteCarloPointOut,
    PDEGridResponse,
    PDESliceOut,
    PriceRequest,
    PriceResponse,
    ProfileResponse,
    TreeNodeOut,
    TreeRequest,
    TreeResponse,
    VanillaInputs,
)
from ..schemas.vanilla import MethodId

router = APIRouter(prefix="/vanilla", tags=["vanilla"])

PROFILE_TREE_STEPS = 201


def _reference_label(american: bool) -> str:
    return REFERENCE_LABEL_AMERICAN if american else REFERENCE_LABEL_EUROPEAN


def _run(
    method: MethodId, label: str, price: Callable[[], PricingResult], reference: float
) -> tuple[MethodResult, PricingResult | None]:
    start = time.perf_counter()
    try:
        result = price()
    except UnsupportedError as e:
        return MethodResult(method=method, label=label, status="unsupported", note=str(e)), None
    except ValueError as e:
        return MethodResult(method=method, label=label, status="error", note=str(e)), None
    runtime = (time.perf_counter() - start) * 1000
    ci = result.confidence_interval()
    return (
        MethodResult(
            method=method,
            label=label,
            status="ok",
            value=result.value,
            stderr=result.stderr,
            ci_low=ci[0] if ci else None,
            ci_high=ci[1] if ci else None,
            abs_error=abs(result.value - reference),
            runtime_ms=runtime,
            greeks=GreeksOut.of(result.greeks),
        ),
        result,
    )


@router.post("/price")
def price(req: PriceRequest) -> PriceResponse:
    option, market, model = req.build()
    reference = reference_value(option, market, model)
    crr = BinomialEngine(req.tree_steps, "crr")
    lr = BinomialEngine(req.tree_steps, "leisen-reimer")
    pde = FiniteDifferenceEngine(req.pde_space_steps, req.pde_space_steps // 2)
    mc = MonteCarloEngine(paths=req.mc_paths, seed=req.seed)

    runs = [
        _run(
            "analytic",
            "Black–Scholes",
            lambda: AnalyticEngine().price(option, market, model),
            reference,
        ),
        _run("crr", crr.label, lambda: crr.price(option, market, model), reference),
        _run("leisen_reimer", lr.label, lambda: lr.price(option, market, model), reference),
        _run("pde", pde.label, lambda: pde.price(option, market, model), reference),
        _run(
            "monte_carlo",
            f"Monte Carlo · {req.mc_paths:,} paths",
            lambda: mc.price(option, market, model),
            reference,
        ),
    ]
    by_method = {m.method: (m, r) for m, r in runs}
    # Headline Greeks: exact when there is a closed form, otherwise the smooth Leisen–Reimer tree.
    source = "analytic" if by_method["analytic"][1] is not None else "leisen_reimer"
    source_row, source_result = by_method[source]
    return PriceResponse(
        reference=reference,
        reference_label=_reference_label(option.is_american),
        greeks=GreeksOut.of(source_result.greeks if source_result else None),
        greeks_label="Analytic" if source == "analytic" else source_row.label,
        methods=[m for m, _ in runs],
    )


@router.post("/profile")
def profile(req: VanillaInputs) -> ProfileResponse:
    option, market, model = req.build()
    low = 0.5 * min(req.spot, req.strike)
    high = 1.5 * max(req.spot, req.strike)
    engine: PricingEngine
    if option.is_american:
        tree = BinomialEngine(PROFILE_TREE_STEPS, "leisen-reimer")
        engine, label, n = tree, tree.label, 61
    else:
        engine, label, n = AnalyticEngine(), "Black–Scholes", 121
    points = spot_profile(engine, option, market, model, np.linspace(low, high, n))

    def greek(name: str) -> list[float | None]:
        return [getattr(p.greeks, name) if p.greeks else None for p in points]

    return ProfileResponse(
        engine_label=label,
        spots=[p.spot for p in points],
        value=[p.value for p in points],
        payoff=[p.payoff for p in points],
        delta=greek("delta"),
        gamma=greek("gamma"),
        vega=greek("vega"),
        theta=greek("theta"),
        rho=greek("rho"),
    )


@router.post("/convergence")
def convergence(req: VanillaInputs) -> ConvergenceResponse:
    option, market, model = req.build()
    reference = reference_value(option, market, model)

    def out(points) -> list[ConvergencePointOut]:
        return [
            ConvergencePointOut(steps=p.steps, value=p.value, abs_error=p.abs_error) for p in points
        ]

    monte_carlo: list[MonteCarloPointOut] = []
    note = None
    try:
        monte_carlo = [
            MonteCarloPointOut(paths=p.paths, value=p.value, stderr=p.stderr)
            for p in monte_carlo_convergence(option, market, model)
        ]
    except UnsupportedError as e:
        note = str(e)
    return ConvergenceResponse(
        reference=reference,
        reference_label=_reference_label(option.is_american),
        crr=out(lattice_convergence(option, market, model, reference, "crr")),
        leisen_reimer=out(
            lattice_convergence(
                option,
                market,
                model,
                reference,
                "leisen-reimer",
                (11, 21, 41, 81, 161, 321, 641, 1281),
            )
        ),
        pde=out(pde_convergence(option, market, model, reference)),
        monte_carlo=monte_carlo,
        monte_carlo_note=note,
    )


@router.post("/implied-vol")
def implied_vol(req: ImpliedVolRequest) -> ImpliedVolResponse:
    option, market = req.build()
    engine: PricingEngine
    if option.is_american:
        tree = BinomialEngine(req.tree_steps, "leisen-reimer", greeks=False)
        engine, label = tree, tree.label
    else:
        engine, label = AnalyticEngine(), "Black–Scholes"
    lower, upper = price_bounds(option, market)

    sigma = iterations = residual = message = None
    try:
        result = implied_volatility(req.price, option, market, engine)
        sigma, iterations, residual = result.volatility, result.iterations, result.residual
    except ValueError as e:
        message = str(e)

    # Price-vs-volatility curve; tree engines cannot price at tiny volatilities, so skip those.
    top = max(1.5, 1.5 * sigma) if sigma else 1.5
    curve_engine = (
        BinomialEngine(151, "leisen-reimer", greeks=False) if option.is_american else engine
    )
    vols, prices = [], []
    for v in np.linspace(0.01, top, 75):
        try:
            prices.append(curve_engine.price(option, market, BlackScholes(float(v))).value)
            vols.append(float(v))
        except ValueError:
            continue

    return ImpliedVolResponse(
        implied_vol=sigma,
        iterations=iterations,
        residual=residual,
        message=message,
        engine_label=label,
        price_lower=lower,
        price_upper=upper,
        curve_vols=vols,
        curve_prices=prices,
    )


@router.post("/tree")
def tree(req: TreeRequest) -> TreeResponse:
    option, market, model = req.build()
    params, nodes = tree_nodes(option, market, model, req.steps, req.scheme)
    return TreeResponse(
        steps=params.steps,
        dt=params.dt,
        up=params.up,
        down=params.down,
        probability=params.probability,
        nodes=[
            TreeNodeOut(
                level=n.level, index=n.index, spot=n.spot, value=n.value, exercised=n.exercised
            )
            for n in nodes
        ],
    )


@router.post("/pde-grid")
def pde_grid(req: VanillaInputs) -> PDEGridResponse:
    option, market, model = req.build()
    *_, grid = solve_pde(option, market, model, 400, 200, keep_grid=True)
    assert grid is not None
    t = option.expiry
    low = 0.4 * min(req.spot, req.strike)
    high = 1.8 * max(req.spot, req.strike)
    keep = (grid.spots >= low) & (grid.spots <= high)
    spots = grid.spots[keep]
    stride = max(1, math.ceil(len(spots) / 160))
    spots = spots[::stride]
    times = t - grid.taus  # calendar time from today

    slices = []
    for fraction in (0.0, 0.5, 0.75, 0.9, 0.98):
        i = int(np.argmin(np.abs(times - fraction * t)))
        slices.append(
            PDESliceOut(time=float(times[i]), values=grid.values[i][keep][::stride].tolist())
        )

    boundary_times: list[float] = []
    boundary_spots: list[float | None] = []
    if option.is_american:
        for i in range(1, len(grid.taus)):
            exercised = grid.exercised[i]
            boundary_times.append(float(times[i]))
            if not exercised.any():
                boundary_spots.append(None)
            elif option.payoff.kind == "put":
                boundary_spots.append(float(grid.spots[exercised].max()))
            else:
                boundary_spots.append(float(grid.spots[exercised].min()))

    return PDEGridResponse(
        spots=spots.tolist(),
        payoff=option.payoff(spots).tolist(),
        slices=slices,
        boundary_times=boundary_times,
        boundary_spots=boundary_spots,
    )
