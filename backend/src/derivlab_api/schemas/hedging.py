"""Delta-hedging simulation schemas."""

from typing import Literal

from pydantic import BaseModel, Field

from .common import OptionKind


class HedgeRequest(BaseModel):
    kind: OptionKind = "call"
    strike: float = Field(100.0, gt=0)
    expiry: float = Field(1.0, gt=0, le=5)
    spot: float = Field(100.0, gt=0)
    rate: float = Field(0.05, ge=-0.1, le=0.5)
    dividend_yield: float = Field(0.0, ge=0, le=0.5)
    realised_volatility: float = Field(0.20, gt=0, le=2, description="What the market delivers")
    hedge_volatility: float = Field(0.20, gt=0, le=2, description="What the hedger assumes")
    position: Literal["short", "long"] = "short"
    rebalances: int = Field(52, ge=1, le=504)
    cost_bps: float = Field(0.0, ge=0, le=100)
    paths: int = Field(2000, ge=100, le=10_000)
    seed: int = 42


class Distribution(BaseModel):
    mean: float
    std: float
    p05: float
    p95: float


class HistogramOut(BaseModel):
    edges: list[float]
    counts: list[int]


class FrequencyPointOut(BaseModel):
    rebalances: int
    mean: float
    std: float
    approx_std: float
    mean_cost: float


class HedgeResponse(BaseModel):
    premium: float
    hedged: Distribution
    unhedged: Distribution
    #: Derman–Kamal approximation of the hedged P&L standard deviation.
    approx_std: float
    mean_cost: float
    histogram: HistogramOut
    sample_times: list[float]
    sample_spots: list[list[float]]
    sample_pnl: list[list[float]]
    frequency: list[FrequencyPointOut]
