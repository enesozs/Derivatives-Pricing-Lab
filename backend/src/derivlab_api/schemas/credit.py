"""Credit schemas. Spreads and rates are decimals (0.01 = 100bp); times in years."""

from pydantic import BaseModel, Field

from derivlab.credit import SAMPLE_CDS_QUOTES, CDSQuote


class CDSQuoteIn(BaseModel):
    maturity: float = Field(gt=0, le=30)
    spread: float = Field(gt=0, le=0.5)

    def build(self) -> CDSQuote:
        return CDSQuote(self.maturity, self.spread)


def _sample() -> list[CDSQuoteIn]:
    return [CDSQuoteIn(maturity=q.maturity, spread=q.spread) for q in SAMPLE_CDS_QUOTES]


class CDSRequest(BaseModel):
    rate: float = Field(0.03, ge=-0.02, le=0.2)
    recovery: float = Field(0.4, ge=0, lt=1)
    quotes: list[CDSQuoteIn] = Field(default_factory=_sample, min_length=1, max_length=15)
    maturity: float = Field(5.0, gt=0, le=30)
    #: Standard running coupon the contract trades at (0.01 = 100bp).
    coupon: float = Field(0.01, ge=0, le=0.2)
    notional: float = Field(10_000_000, gt=0)


class CDSNode(BaseModel):
    maturity: float
    spread: float
    hazard: float
    survival: float
    triangle_hazard: float
    repricing_error: float


class CDSResponse(BaseModel):
    nodes: list[CDSNode]
    grid: list[float]
    survival: list[float]
    hazard: list[float]
    par_spread: float
    rpv01: float
    protection_leg: float
    upfront: float
    default_probability: float
    cs01: float


class XVARequest(BaseModel):
    rate: float = Field(0.03, ge=-0.02, le=0.2)
    a: float = Field(0.05, gt=0, le=2)
    sigma: float = Field(0.01, gt=0, le=0.05)
    maturity: float = Field(10.0, gt=0, le=30)
    frequency: int = Field(1, ge=1, le=4)
    payer: bool = True
    #: None = at the par rate.
    fixed_rate: float | None = Field(None, ge=-0.05, le=0.3)
    notional: float = Field(10_000_000, gt=0)
    counterparty_spread: float = Field(0.015, ge=0, le=0.3)
    counterparty_recovery: float = Field(0.4, ge=0, lt=1)
    #: None = ignore our own default (unilateral CVA).
    own_spread: float | None = Field(0.008, ge=0, le=0.3)
    own_recovery: float = Field(0.4, ge=0, lt=1)
    #: Collateral threshold in currency; None = uncollateralised.
    threshold: float | None = Field(None, ge=0)
    paths: int = Field(5_000, ge=500, le=50_000)


class XVAResponse(BaseModel):
    fixed_rate: float
    swap_value: float
    times: list[float]
    discounted_ee: list[float]
    discounted_ene: list[float]
    epe: list[float]
    pfe95: list[float]
    sample_values: list[list[float]]
    cva: float
    dva: float
    bilateral: float
    cva_running_bp: float
    cva_by_time: list[float]
    dva_by_time: list[float]
    #: At each reset: simulated discounted EE vs the exact Hull–White swaption price.
    check_times: list[float]
    check_simulated: list[float]
    check_exact: list[float]
