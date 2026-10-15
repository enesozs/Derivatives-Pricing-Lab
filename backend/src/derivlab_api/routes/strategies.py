"""Multi-leg option strategy endpoint."""

import numpy as np
from fastapi import APIRouter
from numpy.typing import NDArray

from derivlab import AnalyticEngine, CRREngine, PricingEngine
from derivlab.portfolio import horizon_values, strategy_value

from ..schemas import GreeksOut, LegOut, StrategyRequest, StrategyResponse

router = APIRouter(prefix="/strategies", tags=["strategies"])

GRID_POINTS = 121
AMERICAN_TREE_STEPS = 100


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
    engine: PricingEngine
    if any(p.option.is_american for p in strategy.positions):
        engine, label = CRREngine(AMERICAN_TREE_STEPS), f"CRR tree · {AMERICAN_TREE_STEPS} steps"
    else:
        engine, label = AnalyticEngine(), "Black–Scholes"

    total, legs = strategy_value(strategy, market, model, engine)
    levels = [p.option.payoff.strike for p in strategy.positions] + [market.spot]
    spots = np.linspace(max(0.5 * min(levels), 0.01), 1.5 * max(levels), GRID_POINTS)

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
