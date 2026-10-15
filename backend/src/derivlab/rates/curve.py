"""Discount curves: how much a unit paid at time t is worth today.

Times are year fractions (ACT/365F throughout the rates package: a deliberate simplification,
no calendars, holidays or business-day adjustment; see docs/05-rates.md).

Interpolation is linear in log discount factor, i.e. piecewise-constant instantaneous forward
rates between nodes. It is the simplest scheme that never produces negative forwards from
positive ones and is local (moving one quote moves only its own segment), which is why it is
the default in bootstrapping.
"""

import math
from dataclasses import dataclass

import numpy as np
from numpy.typing import ArrayLike, NDArray


@dataclass(frozen=True)
class DiscountCurve:
    times: tuple[float, ...]
    discount_factors: tuple[float, ...]

    def __post_init__(self) -> None:
        if len(self.times) != len(self.discount_factors) or not self.times:
            raise ValueError("need one discount factor per time")
        if any(b <= a for a, b in zip(self.times, self.times[1:], strict=False)):
            raise ValueError("times must be strictly increasing")
        if self.times[0] <= 0 or any(d <= 0 for d in self.discount_factors):
            raise ValueError("times and discount factors must be positive")

    @staticmethod
    def flat(rate: float, horizon: float = 60.0) -> "DiscountCurve":
        """A flat continuously compounded zero curve."""
        times = (0.25, horizon)
        return DiscountCurve(times, tuple(math.exp(-rate * t) for t in times))

    @property
    def _log_df(self) -> NDArray[np.float64]:
        return np.log(np.array(self.discount_factors))

    def discount(self, t: ArrayLike) -> NDArray[np.float64]:
        """Discount factor; flat forward before the first node and beyond the last."""
        tt = np.asarray(t, dtype=float)
        times = np.array(self.times)
        log_df = self._log_df
        first_rate = -log_df[0] / times[0]
        last_rate = (
            (log_df[-2] - log_df[-1]) / (times[-1] - times[-2]) if len(times) > 1 else first_rate
        )
        inside = np.interp(tt, times, log_df)
        before = -first_rate * tt
        after = log_df[-1] - last_rate * (tt - times[-1])
        return np.exp(np.where(tt < times[0], before, np.where(tt > times[-1], after, inside)))

    def df(self, t: float) -> float:
        return float(self.discount(t))

    def zero_rate(self, t: ArrayLike) -> NDArray[np.float64]:
        """Continuously compounded zero rate: DF(t) = exp(-z t)."""
        tt = np.maximum(np.asarray(t, dtype=float), 1e-8)
        return -np.log(self.discount(tt)) / tt

    def forward_rate(self, t1: ArrayLike, t2: ArrayLike) -> NDArray[np.float64]:
        """Simply compounded forward rate for [t1, t2]: (DF1 / DF2 - 1) / (t2 - t1)."""
        a, b = np.asarray(t1, dtype=float), np.asarray(t2, dtype=float)
        return (self.discount(a) / self.discount(b) - 1) / (b - a)

    def instantaneous_forward(self, t: ArrayLike, h: float = 1e-4) -> NDArray[np.float64]:
        tt = np.asarray(t, dtype=float)
        return -(np.log(self.discount(tt + h)) - np.log(self.discount(np.maximum(tt - h, 0.0)))) / (
            tt + h - np.maximum(tt - h, 0.0)
        )

    def shifted(self, bp: float) -> "DiscountCurve":
        """Parallel shift of continuously compounded zero rates by `bp` basis points."""
        shift = bp / 10_000
        return DiscountCurve(
            self.times,
            tuple(
                d * math.exp(-shift * t)
                for d, t in zip(self.discount_factors, self.times, strict=True)
            ),
        )
