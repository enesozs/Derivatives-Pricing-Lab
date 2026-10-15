"""Reverse convertibles: a high-coupon note that is really a bond plus a short put.

The investor pays 1 and receives a fixed coupon c (whatever happens) plus, at maturity:
- 1 if the stock ends at or above the strike K (a fraction of the initial level), or if the
  barrier version's barrier B was never touched;
- otherwise shares worth S_T / (K S_0): the loss below the strike.
That redemption equals 1 - (K S_0 - S_T)^+ / (K S_0), so

  note = coupons + zero-coupon bond - put(K S_0) / (K S_0),

with a down-and-in put for the barrier version. The coupon is high because the investor is
paid the put premium; the **fair coupon** makes the note worth exactly par. Higher volatility
means a dearer put and a higher coupon, the classic way such notes are marketed.
Reference: Hull ch. 17 (structured products); Bouzoubaa & Osseiran ch. 2.
"""

import math
from dataclasses import dataclass

import numpy as np
from numpy.typing import ArrayLike, NDArray

from derivlab.core.stats import norm_cdf
from derivlab.instruments import BarrierOption, European, PlainVanilla, VanillaOption
from derivlab.market import Market
from derivlab.models import BlackScholes, Model

from ._common import price_instrument


@dataclass(frozen=True)
class ReverseConvertible:
    maturity: float = 1.0
    #: Annual coupon rate, paid `frequency` times a year.
    coupon: float = 0.10
    frequency: int = 4
    #: Conversion strike as a fraction of the initial spot.
    strike: float = 1.0
    #: Continuous down-and-in barrier as a fraction of the initial spot; None = plain.
    barrier: float | None = None

    def __post_init__(self) -> None:
        if not 0 < self.maturity <= 10 or not 1 <= self.frequency <= 12:
            raise ValueError("need 0 < maturity <= 10 and 1 <= frequency <= 12")
        if self.strike <= 0 or self.coupon < 0:
            raise ValueError("strike must be positive and coupon non-negative")
        if self.barrier is not None and not 0 < self.barrier <= self.strike:
            raise ValueError("barrier must be positive and at or below the strike")

    def coupon_times(self) -> NDArray[np.float64]:
        n = max(1, round(self.maturity * self.frequency))
        return self.maturity - np.arange(n)[::-1] / self.frequency

    def put(self, reference: float, spot: float | None = None) -> VanillaOption | BarrierOption:
        """The embedded put on the initial fixing `reference`. A barrier at or above today's
        `spot` has already been touched, so the put is then plain."""
        k = self.strike * reference
        if self.barrier is None or (spot is not None and spot <= self.barrier * reference):
            return VanillaOption(PlainVanilla("put", k), European(self.maturity))
        return BarrierOption("put", k, self.maturity, self.barrier * reference, "down", "in")

    def decompose(
        self, market: Market, model: Model, reference: float | None = None
    ) -> dict[str, float]:
        """Per unit notional: the bond, the coupon strip, the short put, and the fair coupon.
        `reference` is the initial fixing (default: today's spot, i.e. a new note)."""
        fixing = market.spot if reference is None else reference
        times = self.coupon_times()
        annuity = float(sum(market.discount(float(t)) for t in times)) / self.frequency
        bond = market.discount(self.maturity)
        put = price_instrument(self.put(fixing, market.spot), market, model) / (
            self.strike * fixing
        )
        return {
            "bond": bond,
            "coupons": self.coupon * annuity,
            "short_put": -put,
            "value": bond + self.coupon * annuity - put,
            "fair_coupon": (1 - bond + put) / annuity,
            "annuity": annuity,
        }

    def value(self, market: Market, model: Model, reference: float | None = None) -> float:
        return self.decompose(market, model, reference)["value"]

    def redemption(self, final_ratio: ArrayLike, barrier_hit: bool = True) -> NDArray[np.float64]:
        """Amount repaid at maturity per unit notional, given S_T / S_0 (coupons excluded)."""
        x = np.asarray(final_ratio, dtype=float)
        converted = np.minimum(x / self.strike, 1.0)
        if self.barrier is not None and not barrier_hit:
            return np.ones_like(x)
        return converted


def barrier_hit_probability(note: ReverseConvertible, market: Market, model: BlackScholes) -> float:
    """Risk-neutral probability that the stock touches the barrier before maturity (GBM
    first-passage: Shreve vol. II, 7.2)."""
    if note.barrier is None:
        return 0.0
    sigma, t = model.volatility, note.maturity
    nu = market.rate - market.dividend_yield - 0.5 * sigma**2
    b = math.log(note.barrier)
    width = sigma * math.sqrt(t)
    return norm_cdf((b - nu * t) / width) + math.exp(2 * nu * b / sigma**2) * norm_cdf(
        (b + nu * t) / width
    )
