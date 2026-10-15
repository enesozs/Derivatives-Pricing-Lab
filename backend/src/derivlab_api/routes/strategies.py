"""Multi-leg option strategy endpoint."""

from dataclasses import replace

import numpy as np
from fastapi import APIRouter
from numpy.typing import NDArray

from derivlab import AnalyticEngine, BinomialEngine, PricingEngine
from derivlab.portfolio import Strategy, horizon_values, strategy_value

from ..schemas import (
    GreeksOut,
    LegOut,
    ScenarioRequest,
    ScenarioResponse,
    StrategyRequest,
    StrategyResponse,
)

router = APIRouter(prefix="/strategies", tags=["strategies"])

GRID_POINTS = 121
AMERICAN_TREE_STEPS = 101


def _engine(strategy: Strategy) -> PricingEngine:
    if any(p.option.is_american for p in strategy.positions):
        return BinomialEngine(AMERICAN_TREE_STEPS, "leisen-reimer")
    return AnalyticEngine()


def _engine_label(engine: PricingEngine) -> str:
    return engine.label if isinstance(engine, BinomialEngine) else "Black–Scholes"


def _spot_grid(strategy: Strategy, spot: float, points: int) -> NDArray[np.float64]:
    levels = [p.option.payoff.strike for p in strategy.positions] + [spot]
    return np.linspace(max(0.5 * min(levels), 0.01), 1.5 * max(levels), points)


def _breakevens(spots: NDArray[np.float64], pnl: NDArray[np.float64]) -> list[float]:
    """Spots where P&L crosses zero, by linear interpolation between grid points."""
    crossings = []
    for i in range(len(spots) - 1):
        a, b = pnl[i], pnl[i + 1]
        if a == 0:
            crossings.append(float(spots[i]))
        elif a * b < 0:
            crossings.append(float(spots[i] - a * (spots[i + 1] - spots[i]) / (b - a)))
    return crossings


@router.post("/analyze")
def analyze(req: StrategyRequest) -> StrategyResponse:
    strategy, market, model = req.build()
    engine = _engine(strategy)
    label = _engine_label(engine)

    total, legs = strategy_value(strategy, market, model, engine)
    spots = _spot_grid(strategy, market.spot, GRID_POINTS)

    horizon = strategy.horizon
    pnl_today = horizon_values(strategy, market, model, engine, spots, 0.0) - total.value
    pnl_horizon = horizon_values(strategy, market, model, engine, spots, horizon) - total.value

    # Extremes over all spots: include S -> 0 (off the plot) and check the slope far to the right.
    near_zero = horizon_values(strategy, market, model, engine, [1e-6], horizon)[0] - total.value
    far = horizon_values(strategy, market, model, engine, [10 * spots[-1], 20 * spots[-1]], horizon)
    slope = (far[1] - far[0]) / (10 * spots[-1])
    candidates = np.append(pnl_horizon, [near_zero, far[0] - total.value])
    max_profit = None if slope > 1e-6 else float(candidates.max())
    max_loss = None if slope < -1e-6 else float(candidates.min())

    return StrategyResponse(
        net_value=total.value,
        greeks=GreeksOut.of(total.greeks),
        legs=[
            LegOut(
                unit_value=r.value,
                position_value=p.quantity * r.value,
                greeks=GreeksOut.of(r.greeks),
            )
            for p, r in zip(strategy.positions, legs, strict=True)
        ],
        engine_label=label,
        horizon=horizon,
        spots=spots.tolist(),
        pnl_today=pnl_today.tolist(),
        pnl_horizon=pnl_horizon.tolist(),
        breakevens=_breakevens(spots, pnl_horizon),
        max_profit=max_profit,
        max_loss=max_loss,
    )


@router.post("/scenarios")
def scenarios(req: ScenarioRequest) -> ScenarioResponse:
    """P&L across spot and volatility shifts at a chosen date: a stress-test grid."""
    strategy, market, model = req.build()
    engine = _engine(strategy)
    elapsed = min(req.elapsed, strategy.horizon)
    cost = strategy_value(strategy, market, model, engine)[0].value
    spots = _spot_grid(strategy, market.spot, 25)
    pnl = []
    for shift in req.vol_shifts:
        shocked = replace(model, volatility=max(model.volatility + shift, 0.01))
        pnl.append(
            (horizon_values(strategy, market, shocked, engine, spots, elapsed) - cost).tolist()
        )
    return ScenarioResponse(
        elapsed=elapsed, spots=spots.tolist(), vol_shifts=req.vol_shifts, pnl=pnl
    )
