"""Interest-rate schemas. Rates are decimals; times are years (ACT/365F, no calendars)."""

from typing import Literal

from pydantic import BaseModel, Field

from derivlab.rates import SAMPLE_QUOTES, Quote


class QuoteIn(BaseModel):
    kind: Literal["deposit", "fra", "swap"]
    maturity: float = Field(gt=0, le=60)
    rate: float = Field(ge=-0.05, le=0.5)
    start: float = Field(0.0, ge=0)
    frequency: int = Field(1, ge=1, le=12)

    def build(self) -> Quote:
        return Quote(self.kind, self.maturity, self.rate, self.start, self.frequency)


def _sample() -> list[QuoteIn]:
    return [
        QuoteIn(kind=q.kind, maturity=q.maturity, rate=q.rate, start=q.start, frequency=q.frequency)
        for q in SAMPLE_QUOTES
    ]


class CurveInput(BaseModel):
    quotes: list[QuoteIn] = Field(default_factory=_sample, min_length=1, max_length=40)


class CurveResponse(BaseModel):
    node_labels: list[str]
    node_times: list[float]
    node_discount: list[float]
    node_zero: list[float]
    repricing_errors: list[float]
    grid: list[float]
    zero: list[float]
    forward: list[float]
    discount: list[float]
    par_tenors: list[float]
    par_rates: list[float]


class SwapRequest(CurveInput):
    maturity: float = Field(5.0, gt=0, le=50)
    #: None = the par rate (a swap worth zero today).
    fixed_rate: float | None = Field(None, ge=-0.05, le=0.5)
    frequency: int = Field(1, ge=1, le=12)
    notional: float = Field(10_000_000, gt=0)
    payer: bool = True


class SwapResponse(BaseModel):
    fixed_rate: float
    par_rate: float
    npv: float
    annuity: float
    dv01: float
    cash_flows: list[dict[str, float]]
    shifts_bp: list[float]
    shifted_npv: list[float]


class BondRequest(CurveInput):
    coupon: float = Field(0.04, ge=0, le=0.5)
    maturity: float = Field(10.0, gt=0, le=50)
    frequency: int = Field(2, ge=1, le=12)


class BondResponse(BaseModel):
    price: float
    yield_to_maturity: float
    macaulay_duration: float
    modified_duration: float
    convexity: float
    dv01: float
    yields: list[float]
    exact: list[float]
    duration_approx: list[float]
    convexity_approx: list[float]


class RateOptionRequest(CurveInput):
    product: Literal["cap", "floor", "payer", "receiver"] = "cap"
    #: None = at the money (forward swap rate / ATM cap strike).
    strike: float | None = Field(None, ge=-0.05, le=0.5)
    maturity: float = Field(5.0, gt=0, le=30, description="Cap/floor maturity")
    expiry: float = Field(1.0, gt=0, le=30, description="Swaption expiry")
    tenor: float = Field(5.0, gt=0, le=30, description="Swap tenor underlying the swaption")
    frequency: int = Field(4, ge=1, le=12)
    vol_model: Literal["black", "bachelier"] = "black"
    #: Black: lognormal vol (0.25 = 25%); Bachelier: normal vol (0.01 = 100bp).
    vol: float = Field(0.25, gt=0, le=5)
    notional: float = Field(10_000_000, gt=0)


class RateOptionResponse(BaseModel):
    price: float
    strike: float
    atm_forward: float
    #: The other model's volatility that gives the same price.
    equivalent_vol: float | None
    caplets: list[dict[str, float]] | None
    smile_strikes: list[float]
    #: Black vols implied by Bachelier prices with the matched ATM normal vol (a skew),
    #: next to the flat Black vol: what each model assumes about the smile.
    smile_black: list[float]
    smile_from_normal: list[float | None]


class ShortRateRequest(CurveInput):
    a: float = Field(0.05, gt=0, le=2)
    sigma: float = Field(0.01, gt=0, le=0.1)
    vasicek_b: float = Field(0.04, ge=-0.05, le=0.3)
    horizon: float = Field(10.0, gt=0, le=30)
    swaption_expiry: float = Field(2.0, gt=0, le=10)
    swaption_tenor: float = Field(5.0, gt=0, le=20)


class FanOut(BaseModel):
    times: list[float]
    p05: list[float]
    p25: list[float]
    p50: list[float]
    p75: list[float]
    p95: list[float]


class ShortRateResponse(BaseModel):
    hull_white: FanOut
    vasicek: FanOut
    market_zero_times: list[float]
    market_zero: list[float]
    vasicek_zero: list[float]
    hull_white_zero: list[float]
    swaption_strike: float
    european_jamshidian: float
    european_tree: float
    bermudan_tree: float


class CalibrationRequest(CurveInput):
    maturities: list[float] = Field(default=[1, 2, 3, 5, 7, 10], min_length=2, max_length=15)
    black_vols: list[float] = Field(
        default=[0.30, 0.28, 0.26, 0.24, 0.22, 0.21], min_length=2, max_length=15
    )


class CalibrationResponse(BaseModel):
    a: float
    sigma: float
    rmse: float
    maturities: list[float]
    market_vols: list[float]
    model_vols: list[float]
