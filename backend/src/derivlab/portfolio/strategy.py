"""Option strategies: signed positions in several options plus, optionally, the underlying.

A positive quantity is long (bought), negative is short (sold). Values and Greeks are additive,
so a strategy is priced leg by leg with any engine and summed.

"Value at horizon" re-prices every leg at a future date: legs expiring then are worth their
payoff, longer-dated legs keep their remaining time value. This handles calendar spreads, not
just same-expiry strategies. Premium financing (interest on cash paid or received) is ignored.
"""

from collections.abc import Iterable
from dataclasses import dataclass, field, replace

import numpy as np
from numpy.typing import NDArray

from derivlab.engines import PricingEngine
from derivlab.instruments import VanillaOption
from derivlab.market import Market
from derivlab.models import BlackScholes
from derivlab.results import Greeks, PricingResult


@dataclass(frozen=True)
class Position:
    option: VanillaOption
    quantity: float


@dataclass(frozen=True)
class Strategy:
    positions: tuple[Position, ...]
    #: Units of the underlying held (e.g. +1 for a covered call).
    underlying_quantity: float = 0.0
    name: str = field(default="Custom", compare=False)

    def __post_init__(self) -> None:
        if not self.positions and self.underlying_quantity == 0:
            raise ValueError("a strategy needs at least one position")

    @property
    def horizon(self) -> float:
        """The earliest expiry: the natural date to read the strategy's P&L."""
        return min((p.option.expiry for p in self.positions), default=0.0)


def _sum_greeks(weighted: Iterable[tuple[float, Greeks | None]]) -> Greeks | None:
    total = {"delta": 0.0, "gamma": 0.0, "vega": 0.0, "theta": 0.0, "rho": 0.0}
    for quantity, greeks in weighted:
        if greeks is None:
            return None
        for name in total:
            total[name] += quantity * getattr(greeks, name)
    return Greeks(**total)


def strategy_value(
    strategy: Strategy, market: Market, model: BlackScholes, engine: PricingEngine
) -> tuple[PricingResult, list[PricingResult]]:
    """Total value and Greeks (signed by quantity) plus the per-unit result of each leg."""
    legs = [engine.price(p.option, market, model) for p in strategy.positions]
    stock = strategy.underlying_quantity
    value = stock * market.spot + sum(
        p.quantity * r.value for p, r in zip(strategy.positions, legs, strict=True)
    )
    greeks = _sum_greeks(
        [(p.quantity, r.greeks) for p, r in zip(strategy.positions, legs, strict=True)]
        + [(stock, Greeks(1.0, 0.0, 0.0, 0.0, 0.0))]
    )
    return PricingResult(value, greeks=greeks), legs


def horizon_values(
    strategy: Strategy,
    market: Market,
    model: BlackScholes,
    engine: PricingEngine,
    spots: Iterable[float],
    elapsed: float,
) -> NDArray[np.float64]:
    """Strategy value at each spot after `elapsed` years, all else unchanged."""
    aged = [replace(p, option=p.option.aged(elapsed)) for p in strategy.positions]
    values = []
    for s in spots:
        shifted = replace(market, spot=float(s))
        total = strategy.underlying_quantity * float(s)
        total += sum(p.quantity * engine.price(p.option, shifted, model).value for p in aged)
        values.append(total)
    return np.asarray(values)
