"""Multi-asset (correlation) and quanto endpoints."""

import time
from collections.abc import Callable

import numpy as np
from fastapi import APIRouter

from derivlab import PricingResult, UnsupportedError
from derivlab.multi_asset import (
    BasketOption,
    CorrelatedBlackScholes,
    ExchangeOption,
    MultiAssetAnalyticEngine,
    MultiAssetMarket,
    MultiAssetMonteCarloEngine,
    QuantoMarket,
    QuantoModel,
    QuantoOption,
    RainbowOption,
    SpreadOption,
    correlated_paths,
)
from derivlab.multi_asset.analytic import quanto_price
from derivlab.multi_asset.montecarlo import quanto_monte_carlo

from ..schemas.multi_asset import (
    MethodOut,
    MultiAssetRequest,
    MultiAssetResponse,
    QuantoRequest,
    QuantoResponse,
)

router = APIRouter(prefix="/multi-asset", tags=["multi-asset"])

SCATTER_POINTS = 600


def _build(req: MultiAssetRequest):
    n = len(req.assets)
    if req.product == "exchange":
        option = ExchangeOption(req.expiry)
    elif req.product == "spread":
        option = SpreadOption(req.kind, req.strike, req.expiry)
    elif req.product == "basket":
        option = BasketOption(req.kind, req.strike, req.expiry, tuple(1.0 / n for _ in range(n)))
    else:
        option = RainbowOption(
            req.kind, req.strike, req.expiry, "best" if req.product == "best_of" else "worst"
        )
    market = MultiAssetMarket(
        tuple(a.spot for a in req.assets), req.rate, tuple(a.dividend_yield for a in req.assets)
    )
    vols = tuple(a.volatility for a in req.assets)
    return option, market, vols


def _model(vols: tuple[float, ...], rho: float) -> CorrelatedBlackScholes:
    return CorrelatedBlackScholes.uniform(vols, min(rho, 0.9999))


def _run(label: str, fn: Callable[[], PricingResult]) -> tuple[MethodOut, PricingResult | None]:
    start = time.perf_counter()
    try:
        result = fn()
    except UnsupportedError as e:
        return MethodOut(label=label, status="unsupported", note=str(e)), None
    note = result.diagnostics.get("method") or result.diagnostics.get("control_variate")
    return (
        MethodOut(
            label=label,
            status="ok",
            value=result.value,
            stderr=result.stderr,
            runtime_ms=(time.perf_counter() - start) * 1000,
            note=str(note) if note else None,
        ),
        result,
    )


@router.post("/price")
def price(req: MultiAssetRequest) -> MultiAssetResponse:
    option, market, vols = _build(req)
    model = _model(vols, req.correlation)
    analytic = MultiAssetAnalyticEngine()
    mc = MultiAssetMonteCarloEngine(paths=req.mc_paths, seed=req.seed)
    exact_row, exact = _run("Closed form", lambda: analytic.price(option, market, model))
    mc_row, simulated = _run(
        f"Monte Carlo · {req.mc_paths:,} paths", lambda: mc.price(option, market, model)
    )
    best = exact if exact is not None else simulated
    assert best is not None
    value_label = exact_row.label if exact is not None else mc_row.label

    # Price as a function of the (uniform) correlation, with one engine throughout.
    n = len(vols)
    low = max(-0.95, -1 / (n - 1) + 0.02)
    grid = np.linspace(low, 0.99, 25)
    curve_engine = (
        analytic if exact is not None else MultiAssetMonteCarloEngine(paths=20_000, seed=req.seed)
    )
    curve = [curve_engine.price(option, market, _model(vols, float(r))).value for r in grid]
    h = 0.01
    up = min(req.correlation + h, 0.9999)
    down = max(req.correlation - h, low)
    sensitivity = (
        curve_engine.price(option, market, _model(vols, up)).value
        - curve_engine.price(option, market, _model(vols, down)).value
    ) / (up - down)

    sample = correlated_paths(
        market, model, req.expiry, 1, SCATTER_POINTS, np.random.default_rng(req.seed), False
    )
    terminal = sample[:, -1, :]
    returns = np.log(terminal / np.array(market.spots))
    pays = option.payoff(terminal) > 0
    return MultiAssetResponse(
        value=best.value,
        value_label=value_label,
        methods=[exact_row, mc_row],
        correlation_sensitivity=sensitivity,
        correlation_grid=grid.tolist(),
        correlation_values=curve,
        correlation_engine="Closed form"
        if exact is not None
        else "Monte Carlo · 20,000 paths, common random numbers",
        scatter_x=returns[:, 0].tolist(),
        scatter_y=returns[:, 1].tolist(),
        scatter_pays=pays.tolist(),
    )


@router.post("/quanto")
def quanto(req: QuantoRequest) -> QuantoResponse:
    option = QuantoOption(req.kind, req.strike, req.expiry, req.fixed_fx)
    market = QuantoMarket(req.spot, req.domestic_rate, req.foreign_rate, req.dividend_yield)

    def model(rho: float) -> QuantoModel:
        return QuantoModel(req.asset_volatility, req.fx_volatility, rho)

    mc = quanto_monte_carlo(option, market, model(req.correlation), req.mc_paths)
    grid = np.linspace(-0.95, 0.95, 39)
    return QuantoResponse(
        value=quanto_price(option, market, model(req.correlation)),
        mc_value=mc.value,
        mc_stderr=mc.stderr or 0.0,
        uncorrelated_value=quanto_price(option, market, model(0.0)),
        drift_adjustment=-req.correlation * req.asset_volatility * req.fx_volatility,
        correlation_grid=grid.tolist(),
        correlation_values=[quanto_price(option, market, model(float(r))) for r in grid],
    )
