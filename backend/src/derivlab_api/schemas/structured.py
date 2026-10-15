"""Structured product schemas. Levels are fractions of the initial fixing (1.0 = 100%)."""

from typing import Annotated, Literal

from pydantic import BaseModel, Field

from derivlab import Market, Merton

from .exotics import BlackScholesModelSpec, HestonModelSpec
from .hedging import HistogramOut


class MertonModelSpec(BaseModel):
    type: Literal["merton"] = "merton"
    volatility: float = Field(0.2, gt=0, le=2)
    intensity: float = Field(0.5, ge=0, le=10)
    jump_mean: float = Field(-0.1, ge=-1, le=1)
    jump_volatility: float = Field(0.15, ge=0, le=2)

    def build(self) -> Merton:
        return Merton(self.volatility, self.intensity, self.jump_mean, self.jump_volatility)


ModelSpec = Annotated[BlackScholesModelSpec | HestonModelSpec, Field(discriminator="type")]
VarianceModelSpec = Annotated[
    BlackScholesModelSpec | HestonModelSpec | MertonModelSpec, Field(discriminator="type")
]


def _bs() -> BlackScholesModelSpec:
    return BlackScholesModelSpec.model_validate({})


class MarketInput(BaseModel):
    rate: float = Field(0.03, ge=-0.05, le=0.3)
    dividend_yield: float = Field(0.01, ge=0, le=0.3)

    def market(self, spot: float = 100.0) -> Market:
        return Market(spot, self.rate, self.dividend_yield)


class Curve(BaseModel):
    """A sensitivity: x values and the matching outputs."""

    x: list[float]
    y: list[float]


# --- autocallable ------------------------------------------------------------------------------


class AutocallableRequest(MarketInput):
    maturity: float = Field(3.0, gt=0, le=10)
    frequency: Literal[1, 2, 4, 12] = 4
    coupon: float = Field(0.08, ge=0, le=1)
    autocall_level: float = Field(1.0, gt=0, le=2)
    coupon_barrier: float = Field(0.7, gt=0, le=2)
    protection_barrier: float = Field(0.6, gt=0, le=1)
    memory: bool = True
    monitoring: Literal["maturity", "daily"] = "maturity"
    non_call_periods: int = Field(0, ge=0, le=40)
    assets: int = Field(1, ge=1, le=3)
    #: Uniform pairwise correlation for worst-of notes.
    correlation: float = Field(0.5, ge=0, le=0.99)
    model: ModelSpec = Field(default_factory=_bs)
    paths: int = Field(20_000, ge=2_000, le=200_000)


class AutocallableResponse(BaseModel):
    value: float
    stderr: float
    fair_coupon: float
    observation_times: list[float]
    redemption_probabilities: list[float]
    loss_probability: float
    expected_life: float
    principal_value: float
    coupon_annuity: float
    returns: HistogramOut
    #: Fair coupon against volatility level (and against correlation for worst-ofs).
    coupon_vs_vol: Curve
    coupon_vs_correlation: Curve | None


# --- reverse convertible -------------------------------------------------------------------------


class ReverseConvertibleRequest(MarketInput):
    maturity: float = Field(1.0, gt=0, le=10)
    coupon: float = Field(0.10, ge=0, le=1)
    frequency: Literal[1, 2, 4, 12] = 4
    strike: float = Field(1.0, gt=0, le=2)
    barrier: float | None = Field(0.7, gt=0, le=2)
    model: ModelSpec = Field(default_factory=_bs)


class ReverseConvertibleResponse(BaseModel):
    bond: float
    coupons: float
    short_put: float
    value: float
    fair_coupon: float
    barrier_hit_probability: float | None
    final_levels: list[float]
    #: Redemption (coupons excluded) if the barrier was touched / never touched.
    redemption_hit: list[float]
    redemption_not_hit: list[float]
    coupon_total: float
    coupon_vs_vol: Curve


# --- variance swap -------------------------------------------------------------------------------


class VarianceRequest(MarketInput):
    expiry: float = Field(1.0, gt=0, le=5)
    n_strikes: int = Field(41, ge=5, le=401)
    width: float = Field(6.0, ge=1, le=12)
    model: VarianceModelSpec = Field(default_factory=_bs)
    paths: int = Field(20_000, ge=2_000, le=100_000)


class VarianceResponse(BaseModel):
    expected_variance: float
    replicated_variance: float
    forward: float
    strikes: list[float]
    weights: list[float]
    option_prices: list[float]
    contributions: list[float]
    implied_vols: list[float | None]
    #: Replicated variance strike against the number of strikes (same range).
    convergence: Curve
    simulated_variance: float
    simulated_variance_stderr: float
    fair_volatility: float
    fair_volatility_stderr: float
    convexity_adjustment: float
    realised_vols: HistogramOut


# --- cliquet -------------------------------------------------------------------------------------


class CliquetRequest(MarketInput):
    maturity: float = Field(3.0, gt=0, le=10)
    periods: int = Field(12, ge=1, le=60)
    local_floor: float | None = Field(0.0, ge=-1, le=1)
    local_cap: float | None = Field(0.02, gt=-1, le=1)
    global_floor: float | None = Field(0.0, ge=-1, le=5)
    global_cap: float | None = Field(None, gt=-1, le=10)
    #: Volatility level shared by both models; Heston uses v0 = theta = level^2.
    volatility: float = Field(0.2, gt=0, le=1)
    kappa: float = Field(1.5, gt=0, le=10)
    xi: float = Field(0.6, gt=0, le=3)
    rho: float = Field(-0.7, gt=-1, lt=1)
    paths: int = Field(40_000, ge=2_000, le=200_000)


class ModelValue(BaseModel):
    value: float
    stderr: float


class CliquetResponse(BaseModel):
    black_scholes: ModelValue
    heston: ModelValue
    closed_form: float | None
    payoffs_black_scholes: HistogramOut
    payoffs_heston: HistogramOut
    value_vs_local_cap: dict[str, Curve]
    #: An at-the-money forward-start call over the last period, both models.
    forward_start: dict[str, ModelValue]
    forward_start_closed_form: float


# --- portfolio risk ------------------------------------------------------------------------------

ProductKind = Literal[
    "call",
    "put",
    "digital_call",
    "digital_put",
    "down_in_put",
    "up_out_call",
    "reverse_convertible",
    "autocallable",
]


class PositionIn(BaseModel):
    product: ProductKind
    #: Strike (options) or conversion strike (notes), in % of today's spot.
    strike: float = Field(100.0, gt=0, le=300)
    #: Barrier in % of spot (barriers, notes' protection); ignored otherwise.
    barrier: float | None = Field(None, gt=0, le=300)
    expiry: float = Field(1.0, gt=0, le=10)
    #: Number of options, or notional for notes. Negative = short.
    quantity: float = Field(1.0, ge=-1e9, le=1e9)
    #: Annual coupon for notes.
    coupon: float = Field(0.08, ge=0, le=1)
    label: str = ""


class RiskRequest(MarketInput):
    volatility: float = Field(0.25, gt=0.01, le=1.5)
    positions: list[PositionIn] = Field(min_length=1, max_length=20)


class PositionRisk(BaseModel):
    label: str
    value: float
    delta: float
    gamma: float
    vega: float
    rho: float


class ScenarioOut(BaseModel):
    name: str
    full: float
    taylor: float


class RiskResponse(BaseModel):
    positions: list[PositionRisk]
    total: PositionRisk
    spot_shifts: list[float]
    vol_shifts: list[float]
    #: P&L per (vol shift, spot shift); rows are vol shifts.
    grid: list[list[float]]
    scenarios: list[ScenarioOut]
