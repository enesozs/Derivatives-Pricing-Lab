"""Exotic option schemas."""

from typing import Annotated, Literal

from pydantic import BaseModel, Field

from derivlab import (
    AsianOption,
    BarrierOption,
    BlackScholes,
    DigitalOption,
    Heston,
    LookbackOption,
    Market,
)

from .common import GreeksOut, OptionKind


class DigitalSpec(BaseModel):
    type: Literal["digital"] = "digital"
    kind: OptionKind = "call"
    strike: float = Field(100.0, gt=0)
    expiry: float = Field(1.0, gt=0, le=10)
    payout: Literal["cash", "asset"] = "cash"
    cash: float = Field(10.0, gt=0)

    def build(self) -> DigitalOption:
        return DigitalOption(self.kind, self.strike, self.expiry, self.payout, self.cash)


class BarrierSpec(BaseModel):
    type: Literal["barrier"] = "barrier"
    kind: OptionKind = "call"
    strike: float = Field(100.0, gt=0)
    expiry: float = Field(1.0, gt=0, le=10)
    barrier: float = Field(85.0, gt=0)
    direction: Literal["up", "down"] = "down"
    knock: Literal["in", "out"] = "out"
    observations: int | None = Field(None, ge=1, le=2520)

    def build(self) -> BarrierOption:
        return BarrierOption(
            self.kind,
            self.strike,
            self.expiry,
            self.barrier,
            self.direction,
            self.knock,
            self.observations,
        )


class AsianSpec(BaseModel):
    type: Literal["asian"] = "asian"
    kind: OptionKind = "call"
    strike: float = Field(100.0, gt=0)
    expiry: float = Field(1.0, gt=0, le=10)
    fixings: int = Field(12, ge=1, le=520)
    averaging: Literal["arithmetic", "geometric"] = "arithmetic"
    strike_type: Literal["fixed", "floating"] = "fixed"

    def build(self) -> AsianOption:
        return AsianOption(
            self.kind, self.strike, self.expiry, self.fixings, self.averaging, self.strike_type
        )


class LookbackSpec(BaseModel):
    type: Literal["lookback"] = "lookback"
    kind: OptionKind = "call"
    expiry: float = Field(1.0, gt=0, le=10)
    strike_type: Literal["fixed", "floating"] = "floating"
    strike: float = Field(100.0, gt=0)
    observations: int | None = Field(None, ge=1, le=2520)

    def build(self) -> LookbackOption:
        return LookbackOption(
            self.kind, self.expiry, self.strike_type, self.strike, self.observations
        )


ProductSpec = Annotated[
    DigitalSpec | BarrierSpec | AsianSpec | LookbackSpec, Field(discriminator="type")
]


class BlackScholesModelSpec(BaseModel):
    type: Literal["black_scholes"] = "black_scholes"
    volatility: float = Field(0.25, gt=0, le=2)

    def build(self) -> BlackScholes:
        return BlackScholes(self.volatility)


class HestonModelSpec(BaseModel):
    type: Literal["heston"] = "heston"
    v0: float = Field(0.0625, gt=0, le=2)
    kappa: float = Field(1.5, gt=0, le=20)
    theta: float = Field(0.0625, gt=0, le=2)
    xi: float = Field(0.5, gt=0, le=5)
    rho: float = Field(-0.7, gt=-1, lt=1)

    def build(self) -> Heston:
        return Heston(self.v0, self.kappa, self.theta, self.xi, self.rho)


ModelSpec = Annotated[BlackScholesModelSpec | HestonModelSpec, Field(discriminator="type")]


class ExoticRequest(BaseModel):
    product: ProductSpec = Field(default_factory=lambda: BarrierSpec.model_validate({}))
    spot: float = Field(100.0, gt=0)
    rate: float = Field(0.05, ge=-0.1, le=0.5)
    dividend_yield: float = Field(0.02, ge=0, le=0.5)
    model: ModelSpec = Field(default_factory=lambda: BlackScholesModelSpec.model_validate({}))
    mc_paths: int = Field(50_000, ge=1_000, le=500_000)
    seed: int = 42

    @property
    def market(self) -> Market:
        return Market(self.spot, self.rate, self.dividend_yield)


class ExoticMethod(BaseModel):
    method: Literal["analytic", "monte_carlo", "pde"]
    label: str
    status: Literal["ok", "unsupported", "error"]
    value: float | None = None
    stderr: float | None = None
    ci_low: float | None = None
    ci_high: float | None = None
    runtime_ms: float | None = None
    note: str | None = None


class ExoticPriceResponse(BaseModel):
    value: float
    value_label: str
    #: The plain European option with the same strike/expiry/kind, under the same model.
    vanilla_value: float | None
    greeks: GreeksOut | None
    greeks_label: str | None
    methods: list[ExoticMethod]


class ExoticProfileResponse(BaseModel):
    engine_label: str
    spots: list[float]
    value: list[float]
    delta: list[float]
    vanilla_value: list[float] | None
    vanilla_delta: list[float] | None


class ExoticPathsResponse(BaseModel):
    times: list[float]
    paths: list[list[float]]
    payoffs: list[float]
    #: Barrier: whether each path touched the barrier on its monitoring dates.
    hit: list[bool] | None
    #: Asian: the averaging dates; lookback: running extreme per path.
    fixing_times: list[float] | None
    averages: list[float] | None
    extremes: list[list[float]] | None


class AmericanMCRequest(BaseModel):
    kind: OptionKind = "put"
    strike: float = Field(100.0, gt=0)
    expiry: float = Field(1.0, gt=0, le=5)
    spot: float = Field(100.0, gt=0)
    rate: float = Field(0.05, ge=-0.1, le=0.5)
    dividend_yield: float = Field(0.0, ge=0, le=0.5)
    model: ModelSpec = Field(default_factory=lambda: BlackScholesModelSpec.model_validate({}))
    paths: int = Field(50_000, ge=1_000, le=200_000)
    exercise_dates: int = Field(50, ge=1, le=250)
    degree: int = Field(3, ge=1, le=8)


class AmericanMCResponse(BaseModel):
    lsm_value: float
    lsm_stderr: float
    #: Tree (Black–Scholes) or None when no lattice exists for the model.
    reference_value: float | None
    reference_label: str | None
    european_value: float
    exercise_times: list[float]
    lsm_boundary: list[float | None]
    #: PDE early-exercise boundary for comparison (Black–Scholes only).
    reference_times: list[float]
    reference_boundary: list[float | None]
    exercise_points: list[list[float]]
    convergence: list[dict[str, float]]
    runtime_ms: float
