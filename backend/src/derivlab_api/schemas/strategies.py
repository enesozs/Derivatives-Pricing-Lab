"""Option strategy schemas: several signed legs priced together."""

from pydantic import BaseModel, Field

from derivlab import American, BlackScholes, European, Market, PlainVanilla, VanillaOption
from derivlab.portfolio import Position, Strategy

from .common import ExerciseStyle, GreeksOut, OptionKind


class LegIn(BaseModel):
    kind: OptionKind
    exercise: ExerciseStyle = "european"
    strike: float = Field(gt=0)
    expiry: float = Field(gt=0, le=30)
    quantity: float = Field(description="Positive = long (bought), negative = short (sold)")

    def build(self) -> Position:
        exercise = European(self.expiry) if self.exercise == "european" else American(self.expiry)
        return Position(
            VanillaOption(PlainVanilla(self.kind, self.strike), exercise), self.quantity
        )


class StrategyRequest(BaseModel):
    spot: float = Field(100.0, gt=0)
    rate: float = Field(0.05, ge=-0.1, le=0.5)
    dividend_yield: float = Field(0.0, ge=0, le=0.5)
    volatility: float = Field(0.20, gt=0, le=3)
    legs: list[LegIn] = Field(max_length=8)
    underlying_quantity: float = 0.0

    def build(self) -> tuple[Strategy, Market, BlackScholes]:
        strategy = Strategy(tuple(leg.build() for leg in self.legs), self.underlying_quantity)
        return (
            strategy,
            Market(self.spot, self.rate, self.dividend_yield),
            BlackScholes(self.volatility),
        )


class LegOut(BaseModel):
    unit_value: float
    position_value: float
    greeks: GreeksOut | None


class StrategyResponse(BaseModel):
    #: Cost to enter (positive = debit paid, negative = credit received).
    net_value: float
    greeks: GreeksOut | None
    legs: list[LegOut]
    engine_label: str
    #: Years until the earliest expiry; P&L "at horizon" is read on that date.
    horizon: float
    spots: list[float]
    pnl_today: list[float]
    pnl_horizon: list[float]
    breakevens: list[float]
    #: None means unbounded (the P&L keeps growing/falling as spot rises).
    max_profit: float | None
    max_loss: float | None


class ScenarioRequest(StrategyRequest):
    elapsed: float = Field(0.0, ge=0, description="Years from today at which to revalue")
    vol_shifts: list[float] = Field(
        default=[-0.10, -0.075, -0.05, -0.025, 0.0, 0.025, 0.05, 0.075, 0.10, 0.15, 0.20],
        max_length=21,
        description="Absolute volatility changes (0.05 = +5 vol points)",
    )


class ScenarioResponse(BaseModel):
    elapsed: float
    spots: list[float]
    vol_shifts: list[float]
    #: pnl[i][j]: P&L with volatility shifted by vol_shifts[i] at spots[j].
    pnl: list[list[float]]
