"""Linear rates products: fixed-rate bonds and interest-rate swaps (single curve).

Bond price = sum of discounted cash flows. The yield is the single rate (compounded
`frequency` times a year) that reproduces the price. Duration is the price sensitivity to that
yield (in years), and convexity is the curvature: the reason a bond gains more when yields fall
than it loses when they rise by the same amount.

Swap: exchange fixed coupons for floating ones. On a single curve the floating leg is worth
1 - DF(T) per unit notional (it can be replicated by borrowing and lending), so
  par rate = (1 - DF(T)) / annuity,  annuity = sum tau_i DF(t_i),
  payer NPV = notional * annuity * (par rate - fixed rate).
DV01: value change for a 1bp parallel fall in zero rates (positive = gains when rates fall).
Reference: Hull ch. 4 and 7; Andersen & Piterbarg, Interest Rate Modeling vol. 1.
"""

from dataclasses import dataclass

import numpy as np
from numpy.typing import NDArray

from derivlab.core.roots import find_root

from .curve import DiscountCurve
from .schedule import accruals, payment_times


@dataclass(frozen=True)
class FixedRateBond:
    coupon: float
    maturity: float
    frequency: int = 2
    face: float = 100.0

    def cash_flows(self) -> tuple[NDArray[np.float64], NDArray[np.float64]]:
        times = payment_times(0.0, self.maturity, self.frequency)
        flows = self.face * self.coupon * accruals(0.0, times)
        flows[-1] += self.face
        return times, flows

    def price(self, curve: DiscountCurve) -> float:
        times, flows = self.cash_flows()
        return float(flows @ curve.discount(times))

    def price_from_yield(self, y: float) -> float:
        times, flows = self.cash_flows()
        return float(flows @ (1 + y / self.frequency) ** (-self.frequency * times))

    def yield_to_maturity(self, price: float) -> float:
        return find_root(lambda y: self.price_from_yield(y) - price, -0.5, 2.0, xtol=1e-14)

    def risk(self, y: float) -> dict[str, float]:
        """Macaulay and modified duration, convexity and DV01 at yield y."""
        times, flows = self.cash_flows()
        m = self.frequency
        disc = (1 + y / m) ** (-m * times)
        price = float(flows @ disc)
        macaulay = float((times * flows * disc).sum() / price)
        modified = macaulay / (1 + y / m)
        convexity = float(
            (flows * disc * times * (times + 1 / m)).sum() / (price * (1 + y / m) ** 2)
        )
        return {
            "price": price,
            "macaulay_duration": macaulay,
            "modified_duration": modified,
            "convexity": convexity,
            "dv01": modified * price / 10_000,
        }


@dataclass(frozen=True)
class InterestRateSwap:
    fixed_rate: float
    maturity: float
    frequency: int = 1
    notional: float = 1_000_000.0
    payer: bool = True  # pay fixed, receive floating
    start: float = 0.0

    def schedule(self) -> tuple[NDArray[np.float64], NDArray[np.float64]]:
        times = payment_times(self.start, self.start + self.maturity, self.frequency)
        return times, accruals(self.start, times)

    def annuity(self, curve: DiscountCurve) -> float:
        times, tau = self.schedule()
        return float((tau * curve.discount(times)).sum())

    def par_rate(self, curve: DiscountCurve) -> float:
        start_df = curve.df(self.start) if self.start > 0 else 1.0
        return (start_df - curve.df(self.start + self.maturity)) / self.annuity(curve)

    def npv(self, curve: DiscountCurve) -> float:
        sign = 1 if self.payer else -1
        return sign * self.notional * self.annuity(curve) * (self.par_rate(curve) - self.fixed_rate)

    def dv01(self, curve: DiscountCurve) -> float:
        """Value gain for a 1bp parallel *fall* in rates."""
        return self.npv(curve.shifted(-1.0)) - self.npv(curve)

    def cash_flows(self, curve: DiscountCurve) -> list[dict[str, float]]:
        """Per period: fixed coupon, projected floating coupon, discount factor."""
        times, tau = self.schedule()
        starts = times - tau
        floating = curve.forward_rate(starts, times)
        dfs = curve.discount(times)
        return [
            {
                "time": float(t),
                "fixed": float(self.notional * self.fixed_rate * a),
                "floating": float(self.notional * f * a),
                "discount": float(d),
            }
            for t, a, f, d in zip(times, tau, floating, dfs, strict=True)
        ]
