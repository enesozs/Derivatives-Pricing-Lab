"""Vanilla option schemas. Units match the library: decimals, years, per-unit prices."""

from typing import Literal

from pydantic import BaseModel, Field, field_validator

from derivlab import American, BlackScholes, European, Market, PlainVanilla, VanillaOption

from .common import ExerciseStyle, GreeksOut, OptionKind


class VanillaInputs(BaseModel):
    kind: OptionKind = "call"
    exercise: ExerciseStyle = "european"
    strike: float = Field(100.0, gt=0)
    expiry: float = Field(1.0, gt=0, le=30, description="Years")
    spot: float = Field(100.0, gt=0)
    rate: float = Field(0.05, ge=-0.1, le=0.5, description="Continuously compounded")
    dividend_yield: float = Field(0.0, ge=0, le=0.5)
    volatility: float = Field(0.20, gt=0, le=3)

    def build(self) -> tuple[VanillaOption, Market, BlackScholes]:
        exercise = European(self.expiry) if self.exercise == "european" else American(self.expiry)
        option = VanillaOption(PlainVanilla(self.kind, self.strike), exercise)
        return (
            option,
            Market(self.spot, self.rate, self.dividend_yield),
            BlackScholes(self.volatility),
        )


class PriceRequest(VanillaInputs):
    tree_steps: int = Field(500, ge=3, le=5000)
    mc_paths: int = Field(100_000, ge=1_000, le=1_000_000)
    seed: int = 42

    @field_validator("mc_paths")
    @classmethod
    def even_paths(cls, v: int) -> int:
        return v + (v % 2)  # antithetic pairs need an even count


class MethodResult(BaseModel):
    method: Literal["analytic", "crr", "monte_carlo"]
    label: str
    status: Literal["ok", "unsupported", "error"]
    value: float | None = None
    stderr: float | None = None
    ci_low: float | None = None
    ci_high: float | None = None
    abs_error: float | None = None
    runtime_ms: float | None = None
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


class LatticePointOut(BaseModel):
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
    lattice: list[LatticePointOut]
    monte_carlo: list[MonteCarloPointOut]
    monte_carlo_note: str | None = None


class ImpliedVolRequest(BaseModel):
    kind: OptionKind = "call"
    exercise: ExerciseStyle = "european"
    strike: float = Field(100.0, gt=0)
    expiry: float = Field(1.0, gt=0, le=30)
    spot: float = Field(100.0, gt=0)
    rate: float = Field(0.05, ge=-0.1, le=0.5)
    dividend_yield: float = Field(0.0, ge=0, le=0.5)
    price: float = Field(10.45, gt=0, description="Observed option price per unit")
    tree_steps: int = Field(300, ge=10, le=2000, description="Used for American options")

    def build(self) -> tuple[VanillaOption, Market]:
        exercise = European(self.expiry) if self.exercise == "european" else American(self.expiry)
        option = VanillaOption(PlainVanilla(self.kind, self.strike), exercise)
        return option, Market(self.spot, self.rate, self.dividend_yield)


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
