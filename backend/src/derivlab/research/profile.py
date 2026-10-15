"""Value and Greeks of one option across a range of spot prices."""

from collections.abc import Iterable
from dataclasses import dataclass, replace

from derivlab.engines import PricingEngine
from derivlab.instruments import VanillaOption
from derivlab.market import Market
from derivlab.models import BlackScholes
from derivlab.results import Greeks


@dataclass(frozen=True)
class ProfilePoint:
    spot: float
    value: float
    payoff: float
    greeks: Greeks | None


def spot_profile(
    engine: PricingEngine,
    option: VanillaOption,
    market: Market,
    model: BlackScholes,
    spots: Iterable[float],
) -> list[ProfilePoint]:
    points = []
    for s in spots:
        result = engine.price(option, replace(market, spot=float(s)), model)
        points.append(ProfilePoint(float(s), result.value, float(option.payoff(s)), result.greeks))
    return points
