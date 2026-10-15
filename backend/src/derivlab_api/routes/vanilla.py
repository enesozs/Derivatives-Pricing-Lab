"""Vanilla option endpoints."""

import time
from collections.abc import Callable
from typing import Literal

import numpy as np
from fastapi import APIRouter

from derivlab import (
    AnalyticEngine,
    BlackScholes,
    CRREngine,
    MonteCarloEngine,
    PricingEngine,
    PricingResult,
    UnsupportedError,
)
from derivlab.calibration import implied_volatility, price_bounds
from derivlab.research import (
    REFERENCE_TREE_STEPS,
    lattice_convergence,
    monte_carlo_convergence,
    reference_value,
    spot_profile,
)

from ..schemas import (
    ConvergenceResponse,
    GreeksOut,
    ImpliedVolRequest,
    ImpliedVolResponse,
    LatticePointOut,
    MethodResult,
    MonteCarloPointOut,
    PriceRequest,
    PriceResponse,
    ProfileResponse,
    VanillaInputs,
)

router = APIRouter(prefix="/vanilla", tags=["vanilla"])

PROFILE_TREE_STEPS = 200


def _reference_label(american: bool) -> str:
    return f"CRR · {REFERENCE_TREE_STEPS:,} steps" if american else "Black–Scholes closed form"


def _run(
    method: Literal["analytic", "crr", "monte_carlo"],
    label: str,
    price: Callable[[], PricingResult],
    reference: float,
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
        ),
        result,
    )


@router.post("/price")
def price(req: PriceRequest) -> PriceResponse:
    option, market, model = req.build()
    reference = reference_value(option, market, model)

    analytic, analytic_result = _run(
        "analytic",
        "Black–Scholes",
        lambda: AnalyticEngine().price(option, market, model),
        reference,
    )
    crr, crr_result = _run(
        "crr",
        f"CRR tree · {req.tree_steps:,} steps",
        lambda: CRREngine(req.tree_steps).price(option, market, model),
        reference,
    )
    mc, _ = _run(
        "monte_carlo",
        f"Monte Carlo · {req.mc_paths:,} paths",
        lambda: MonteCarloEngine(paths=req.mc_paths, seed=req.seed).price(option, market, model),
        reference,
    )

    greeks_source = analytic_result if analytic_result is not None else crr_result
    greeks_label = "Analytic" if analytic_result is not None else crr.label
    return PriceResponse(
        reference=reference,
        reference_label=_reference_label(option.is_american),
        greeks=GreeksOut.of(greeks_source.greeks if greeks_source else None),
        greeks_label=greeks_label,
        methods=[analytic, crr, mc],
    )


@router.post("/profile")
def profile(req: VanillaInputs) -> ProfileResponse:
    option, market, model = req.build()
    low = 0.5 * min(req.spot, req.strike)
    high = 1.5 * max(req.spot, req.strike)
    if option.is_american:
        engine, label, n = CRREngine(PROFILE_TREE_STEPS), f"CRR · {PROFILE_TREE_STEPS} steps", 61
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
    lattice = [
        LatticePointOut(steps=p.steps, value=p.value, abs_error=p.abs_error)
        for p in lattice_convergence(option, market, model, reference)
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
        lattice=lattice,
        monte_carlo=monte_carlo,
        monte_carlo_note=note,
    )


@router.post("/implied-vol")
def implied_vol(req: ImpliedVolRequest) -> ImpliedVolResponse:
    option, market = req.build()
    engine: PricingEngine
    if option.is_american:
        engine, label = CRREngine(req.tree_steps), f"CRR tree · {req.tree_steps} steps"
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
    curve_engine = CRREngine(150) if option.is_american else engine
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
