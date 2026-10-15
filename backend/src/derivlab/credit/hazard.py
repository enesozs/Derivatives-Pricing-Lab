"""Default-time models: survival curves built from piecewise-constant hazard rates.

A hazard rate lambda(t) is the instantaneous default intensity: given survival to t, the
probability of defaulting in [t, t + dt] is lambda(t) dt. Survival to T is
  Q(T) = exp(-integral_0^T lambda(u) du),
and the probability of default between t1 and t2 is Q(t1) - Q(t2). This is a "reduced-form"
model: default is a surprise (the first jump of a Poisson process), not the result of a
firm's assets falling below its debt.

Rule of thumb ("credit triangle"): with a flat hazard rate, a CDS spread s and recovery R
satisfy s ~ lambda (1 - R). A 120bp spread at 40% recovery is a ~2% annual default rate.
Reference: Hull ch. 24; O'Kane, *Modelling Single-name and Multi-name Credit Derivatives* ch. 3.
"""

import math
from dataclasses import dataclass

import numpy as np
from numpy.typing import ArrayLike, NDArray


@dataclass(frozen=True)
class HazardCurve:
    #: End of each hazard segment (years, increasing); the last rate extends beyond.
    times: tuple[float, ...]
    #: Constant hazard rate on (times[i-1], times[i]].
    hazards: tuple[float, ...]

    def __post_init__(self) -> None:
        if len(self.times) != len(self.hazards) or not self.times:
            raise ValueError("need one hazard rate per segment")
        if any(b <= a for a, b in zip(self.times, self.times[1:], strict=False)):
            raise ValueError("segment ends must be strictly increasing")
        if self.times[0] <= 0 or any(h < 0 or not math.isfinite(h) for h in self.hazards):
            raise ValueError("times must be positive and hazard rates non-negative")

    @staticmethod
    def flat(hazard: float) -> "HazardCurve":
        return HazardCurve((1.0,), (hazard,))

    def _cumulative(self, t: NDArray[np.float64]) -> NDArray[np.float64]:
        ends = np.array(self.times)
        rates = np.array(self.hazards)
        starts = np.concatenate([[0.0], ends[:-1]])
        # Time spent in each segment (the last segment is open-ended).
        upper = np.concatenate([ends[:-1], [np.inf]])
        spent = np.clip(t[..., None] - starts, 0.0, upper - starts)
        return (spent * rates).sum(axis=-1)

    def survival(self, t: ArrayLike) -> NDArray[np.float64]:
        return np.exp(-self._cumulative(np.asarray(t, dtype=float)))

    def default_probability(self, t1: ArrayLike, t2: ArrayLike) -> NDArray[np.float64]:
        return self.survival(t1) - self.survival(t2)

    def hazard(self, t: ArrayLike) -> NDArray[np.float64]:
        idx = np.searchsorted(np.array(self.times), np.asarray(t, dtype=float), side="left")
        return np.array(self.hazards)[np.minimum(idx, len(self.hazards) - 1)]

    def shifted(self, bump: float) -> "HazardCurve":
        return HazardCurve(self.times, tuple(max(h + bump, 0.0) for h in self.hazards))
