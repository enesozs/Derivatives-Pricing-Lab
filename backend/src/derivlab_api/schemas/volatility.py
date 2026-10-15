"""Volatility-surface, calibration and model-playground schemas."""

from datetime import date, datetime
from typing import Annotated, Literal

from pydantic import BaseModel, Field

from derivlab import SABR, BlackScholes, Heston, Merton

SourceKind = Literal["snapshot", "synthetic", "live"]


class SourceRequest(BaseModel):
    source: SourceKind = "snapshot"
    #: Snapshot id (file stem) when source = "snapshot"; newest if omitted.
    snapshot: str | None = None
    #: Ticker when source = "live".
    ticker: str = Field("SPY", min_length=1, max_length=10, pattern=r"^[A-Za-z.\-^]+$")
    #: Risk-free rate used for discounting (forwards still come from put–call parity).
    rate: float = Field(0.04, ge=-0.02, le=0.2)


class SnapshotInfo(BaseModel):
    id: str
    ticker: str
    as_of: datetime
    description: str


class SourcesResponse(BaseModel):
    snapshots: list[SnapshotInfo]
    live_available: bool


class SmilePointOut(BaseModel):
    strike: float
    log_moneyness: float
    implied_vol: float
    kind: Literal["call", "put"]
    price_source: Literal["mid", "last"]


class SVIOut(BaseModel):
    a: float
    b: float
    rho: float
    m: float
    sigma: float
    rmse: float
    butterfly_violations: int
    k_min: float
    k_max: float


class SliceOut(BaseModel):
    expiry: date
    t: float
    forward: float
    discount: float
    forward_method: Literal["parity", "fallback"]
    atm_vol: float
    dropped: dict[str, int]
    points: list[SmilePointOut]
    svi: SVIOut
    #: The SVI fit evaluated on a fine log-moneyness grid, for plotting.
    fit_k: list[float]
    fit_vol: list[float]


class CalendarViolationOut(BaseModel):
    t_short: float
    t_long: float
    count: int


class SurfaceMeta(BaseModel):
    ticker: str
    spot: float
    as_of: datetime
    source: SourceKind
    description: str
    synthetic: bool
    price_basis: Literal["mid", "last", "mixed"]


class SurfaceGrid(BaseModel):
    """Values on a (maturity x log-moneyness) grid; k is relative to the forward at each t."""

    log_moneyness: list[float]
    maturities: list[float]
    implied_vol: list[list[float]]
    local_vol: list[list[float]]
    #: Grid points where Dupire's formula was undefined (arbitrage) and implied vol was used.
    local_vol_fallbacks: int


class SurfaceResponse(BaseModel):
    meta: SurfaceMeta
    slices: list[SliceOut]
    calendar_violations: list[CalendarViolationOut]
    grid: SurfaceGrid


class CalibrationRequest(SourceRequest):
    model: Literal["heston", "sabr"] = "heston"
    #: SABR backbone exponent (fixed during calibration).
    beta: float = Field(1.0, ge=0, le=1)


class SliceFitOut(BaseModel):
    expiry: date
    t: float
    forward: float
    strikes: list[float]
    log_moneyness: list[float]
    market_vol: list[float]
    model_vol: list[float | None]
    rmse: float


class CalibrationResponse(BaseModel):
    model: Literal["heston", "sabr"]
    #: Fitted parameters; for SABR one set per expiry.
    parameters: list[dict[str, float]]
    rmse: float
    runtime_ms: float
    feller_satisfied: bool | None
    slices: list[SliceFitOut]


class BlackScholesParams(BaseModel):
    model: Literal["black_scholes"] = "black_scholes"
    volatility: float = Field(0.2, gt=0, le=2)

    def build(self) -> BlackScholes:
        return BlackScholes(self.volatility)


class HestonParams(BaseModel):
    model: Literal["heston"] = "heston"
    v0: float = Field(0.04, gt=0, le=2)
    kappa: float = Field(1.5, gt=0, le=20)
    theta: float = Field(0.04, gt=0, le=2)
    xi: float = Field(0.5, gt=0, le=5)
    rho: float = Field(-0.7, gt=-1, lt=1)

    def build(self) -> Heston:
        return Heston(self.v0, self.kappa, self.theta, self.xi, self.rho)


class MertonParams(BaseModel):
    model: Literal["merton"] = "merton"
    volatility: float = Field(0.15, ge=0, le=2)
    intensity: float = Field(0.5, ge=0, le=20)
    jump_mean: float = Field(-0.1, ge=-1, le=1)
    jump_volatility: float = Field(0.15, ge=0, le=2)

    def build(self) -> Merton:
        return Merton(self.volatility, self.intensity, self.jump_mean, self.jump_volatility)


class SABRParams(BaseModel):
    model: Literal["sabr"] = "sabr"
    alpha: float = Field(0.2, gt=0, le=5)
    beta: float = Field(1.0, ge=0, le=1)
    rho: float = Field(-0.5, gt=-1, lt=1)
    nu: float = Field(0.5, ge=0, le=5)

    def build(self) -> SABR:
        return SABR(self.alpha, self.beta, self.rho, self.nu)


ModelParams = Annotated[
    BlackScholesParams | HestonParams | MertonParams | SABRParams, Field(discriminator="model")
]


class ModelSmileRequest(BaseModel):
    params: ModelParams
    spot: float = Field(100.0, gt=0)
    rate: float = Field(0.03, ge=-0.1, le=0.5)
    dividend_yield: float = Field(0.0, ge=0, le=0.5)
    expiries: list[float] = Field(default=[0.1, 0.25, 0.5, 1.0, 2.0], min_length=1, max_length=8)


class ModelSmileOut(BaseModel):
    t: float
    strikes: list[float]
    implied_vol: list[float | None]
    #: Risk-neutral density of S_T at `density_spots` (None for SABR: no characteristic function).
    density: list[float] | None


class ModelSmileResponse(BaseModel):
    model: str
    density_spots: list[float]
    smiles: list[ModelSmileOut]
    #: Lognormal density with the same at-the-money vol as the longest expiry, for comparison.
    reference_density: list[float]
