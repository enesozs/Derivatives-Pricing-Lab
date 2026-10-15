"""Vanilla option schemas. Units match the library: decimals, years, per-unit prices."""

from typing import Literal

from pydantic import BaseModel, Field, field_validator

from derivlab import American, BlackScholes, European, Market, PlainVanilla, VanillaOption

from .common import ExerciseStyle, GreeksOut, OptionKind

MethodId = Literal["analytic", "crr", "leisen_reimer", "pde", "monte_carlo"]
TreeScheme = Literal["crr", "jarrow-rudd", "leisen-reimer"]


class ContractInputs(BaseModel):
    kind: OptionKind = "call"
    exercise: ExerciseStyle = "european"
    strike: float = Field(100.0, gt=0)
    expiry: float = Field(1.0, gt=0, le=30, description="Years")
    spot: float = Field(100.0, gt=0)
    rate: float = Field(0.05, ge=-0.1, le=0.5, description="Continuously compounded")
    dividend_yield: float = Field(0.0, ge=0, le=0.5)

    def build_contract(self) -> tuple[VanillaOption, Market]:
        exercise = European(self.expiry) if self.exercise == "european" else American(self.expiry)
        option = VanillaOption(PlainVanilla(self.kind, self.strike), exercise)
        return option, Market(self.spot, self.rate, self.dividend_yield)


class VanillaInputs(ContractInputs):
    volatility: float = Field(0.20, gt=0, le=3)

    def build(self) -> tuple[VanillaOption, Market, BlackScholes]:
        option, market = self.build_contract()
        return option, market, BlackScholes(self.volatility)


class PriceRequest(VanillaInputs):
    tree_steps: int = Field(500, ge=3, le=5000)
    pde_space_steps: int = Field(400, ge=40, le=2000, description="Time steps are half of this")
    mc_paths: int = Field(100_000, ge=1_000, le=1_000_000)
    seed: int = 42

    @field_validator("mc_paths")
    @classmethod
    def even_paths(cls, v: int) -> int:
        return v + (v % 2)  # antithetic pairs need an even count


class MethodResult(BaseModel):
    method: MethodId
    label: str
    status: Literal["ok", "unsupported", "error"]
    value: float | None = None
    stderr: float | None = None
    ci_low: float | None = None
    ci_high: float | None = None
    abs_error: float | None = None
    runtime_ms: float | None = None
    greeks: GreeksOut | None = None
    note: str | None = None


class PriceResponse(BaseModel):
    reference: float
    reference_label: str
    greeks: GreeksOut | None
    greeks_label: str
    methods: list[MethodResult]


class ProfileResponse(BaseModel):
    engine_label: str
    spots: list[float]
    value: list[float]
    payoff: list[float]
    delta: list[float | None]
    gamma: list[float | None]
    vega: list[float | None]
    theta: list[float | None]
    rho: list[float | None]


class ConvergencePointOut(BaseModel):
    steps: int
    value: float
    abs_error: float


class MonteCarloPointOut(BaseModel):
    paths: int
    value: float
    stderr: float


class ConvergenceResponse(BaseModel):
    reference: float
    reference_label: str
    crr: list[ConvergencePointOut]
    leisen_reimer: list[ConvergencePointOut]
    pde: list[ConvergencePointOut]
    monte_carlo: list[MonteCarloPointOut]
    monte_carlo_note: str | None = None


class ImpliedVolRequest(ContractInputs):
    price: float = Field(10.45, gt=0, description="Observed option price per unit")
    tree_steps: int = Field(301, ge=11, le=2001, description="Used for American options")

    def build(self) -> tuple[VanillaOption, Market]:
        return self.build_contract()


class ImpliedVolResponse(BaseModel):
    implied_vol: float | None
    iterations: int | None
    residual: float | None
    #: Why no implied volatility exists, when it does not.
    message: str | None
    engine_label: str
    price_lower: float
    price_upper: float
    #: Model price as a function of volatility, to show what the solver inverts.
    curve_vols: list[float]
    curve_prices: list[float]


class TreeRequest(VanillaInputs):
    steps: int = Field(5, ge=1, le=10)
    scheme: TreeScheme = "crr"


class TreeNodeOut(BaseModel):
    level: int
    index: int
    spot: float
    value: float
    exercised: bool


class TreeResponse(BaseModel):
    steps: int
    dt: float
    up: float
    down: float
    probability: float
    nodes: list[TreeNodeOut]


class PDESliceOut(BaseModel):
    #: Calendar time from today, in years.
    time: float
    values: list[float]


class PDEGridResponse(BaseModel):
    spots: list[float]
    payoff: list[float]
    #: Option value across spot at a handful of dates between today and expiry.
    slices: list[PDESliceOut]
    #: Early-exercise boundary (American only): spot at which exercise starts, per date.
    boundary_times: list[float]
    boundary_spots: list[float | None]
