"""Delta-hedging simulation endpoint."""

import numpy as np
from fastapi import APIRouter
from numpy.typing import NDArray

from derivlab import BlackScholes, European, Market, PlainVanilla, VanillaOption
from derivlab.hedging import hedge_frequency_study, simulate_delta_hedge

from ..schemas import FrequencyPointOut, HedgeRequest, HedgeResponse, HistogramOut
from ..schemas.hedging import Distribution

router = APIRouter(prefix="/hedging", tags=["hedging"])

FREQUENCIES = (4, 12, 26, 52, 104, 252)


def _distribution(x: NDArray[np.float64]) -> Distribution:
    p05, p95 = np.percentile(x, [5, 95])
    return Distribution(
        mean=float(x.mean()), std=float(x.std(ddof=1)), p05=float(p05), p95=float(p95)
    )


@router.post("/delta")
def delta_hedge(req: HedgeRequest) -> HedgeResponse:
    option = VanillaOption(PlainVanilla(req.kind, req.strike), European(req.expiry))
    market = Market(req.spot, req.rate, req.dividend_yield)
    realised = BlackScholes(req.realised_volatility)
    position = -1.0 if req.position == "short" else 1.0
    result = simulate_delta_hedge(
        option,
        market,
        realised,
        req.hedge_volatility,
        position,
        req.rebalances,
        req.paths,
        req.cost_bps,
        req.seed,
        samples=3,
    )
    # Central 99% only: a few extreme paths would otherwise stretch the axis and hide the shape.
    low, high = np.percentile(result.hedged_pnl, [0.5, 99.5])
    counts, edges = np.histogram(result.hedged_pnl, bins=40, range=(low, high))
    study = hedge_frequency_study(
        option,
        market,
        realised,
        req.hedge_volatility,
        position,
        req.cost_bps,
        FREQUENCIES,
        min(req.paths, 2000),
        req.seed,
    )
    return HedgeResponse(
        premium=result.premium,
        hedged=_distribution(result.hedged_pnl),
        unhedged=_distribution(result.unhedged_pnl),
        approx_std=result.approx_std,
        mean_cost=float(result.costs.mean()),
        histogram=HistogramOut(edges=edges.tolist(), counts=counts.tolist()),
        sample_times=result.times.tolist(),
        sample_spots=result.sample_spots.tolist(),
        sample_pnl=result.sample_pnl.tolist(),
        frequency=[
            FrequencyPointOut(
                rebalances=p.rebalances,
                mean=p.mean,
                std=p.std,
                approx_std=p.approx_std,
                mean_cost=p.mean_cost,
            )
            for p in study
        ],
    )
