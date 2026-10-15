"""An implied-volatility surface built from per-expiry SVI fits, and its Dupire local volatility.

Between expiries, total variance w is interpolated linearly in T at fixed log-moneyness
k = ln(K/F(T)). This keeps calendar-arbitrage-free slices arbitrage-free in between. Beyond the
last expiry, implied volatility is held flat; before the first, total variance scales with T.
The forward curve F(T) is interpolated linearly in log F.

Dupire's local variance, written in total implied variance (Gatheral eq. 1.10):

    sigma_loc^2(k, T) = (dw/dT) / ( 1 - (k/w) w_k + (1/4)(-1/4 - 1/w + k^2/w^2) w_k^2 + w_kk / 2 )

The k-derivatives are analytic from SVI and dw/dT is a finite difference in T. Where the
surface has arbitrage, the numerator or denominator goes negative and local variance is
undefined; those points are clipped and counted.
Reference: Gatheral, The Volatility Surface (2006), ch. 1-3.
"""

from __future__ import annotations

import math
from dataclasses import dataclass
from typing import TYPE_CHECKING

import numpy as np
from numpy.typing import ArrayLike, NDArray

from derivlab.models import LocalVol

if TYPE_CHECKING:
    from derivlab.data import SurfaceData

from .svi import SVIFit, fit_svi


@dataclass(frozen=True)
class SurfaceSlice:
    t: float
    forward: float
    discount: float
    fit: SVIFit


@dataclass(frozen=True)
class CalendarViolation:
    t_short: float
    t_long: float
    #: Log-moneyness values where the longer expiry has less total variance.
    log_moneyness: tuple[float, ...]


class VolSurface:
    def __init__(self, spot: float, slices: list[SurfaceSlice]):
        if not slices:
            raise ValueError("a surface needs at least one slice")
        self.spot = spot
        self.slices = sorted(slices, key=lambda s: s.t)
        self._t = np.array([s.t for s in self.slices])
        self._log_f = np.log([s.forward for s in self.slices])

    # --- forwards and total variance ----------------------------------------------------------

    def forward(self, t: float) -> float:
        if t <= self._t[0]:
            # Interpolate from today's spot to the first forward.
            weight = t / self._t[0]
            return float(math.exp((1 - weight) * math.log(self.spot) + weight * self._log_f[0]))
        return float(np.exp(np.interp(t, self._t, self._log_f)))

    def total_variance(self, k: ArrayLike, t: float) -> NDArray[np.float64]:
        kk = np.asarray(k, dtype=float)
        ts, slices = self._t, self.slices
        if t <= ts[0]:
            return slices[0].fit.params.total_variance(kk) * (t / ts[0])
        if t >= ts[-1]:
            return slices[-1].fit.params.total_variance(kk) * (t / ts[-1])
        i = int(np.searchsorted(ts, t)) - 1
        weight = (t - ts[i]) / (ts[i + 1] - ts[i])
        w0 = slices[i].fit.params.total_variance(kk)
        w1 = slices[i + 1].fit.params.total_variance(kk)
        return (1 - weight) * w0 + weight * w1

    def implied_vol(self, strike: ArrayLike, t: float) -> NDArray[np.float64]:
        k = np.log(np.asarray(strike, dtype=float) / self.forward(t))
        return np.sqrt(np.maximum(self.total_variance(k, t), 0.0) / t)

    # --- arbitrage ------------------------------------------------------------------------------

    def calendar_violations(self) -> list[CalendarViolation]:
        """Adjacent expiries where total variance decreases with maturity, checked only where
        both slices have quotes (extrapolated wings say nothing about the market)."""
        violations = []
        for short, long in zip(self.slices, self.slices[1:], strict=False):
            low = max(short.fit.k_range[0], long.fit.k_range[0])
            high = min(short.fit.k_range[1], long.fit.k_range[1])
            if low >= high:
                continue
            grid = np.linspace(low, high, 101)
            w_short = short.fit.params.total_variance(grid)
            w_long = long.fit.params.total_variance(grid)
            bad = grid[w_long < w_short - 1e-8]
            if bad.size:
                violations.append(CalendarViolation(short.t, long.t, tuple(float(x) for x in bad)))
        return violations

    # --- Dupire local volatility --------------------------------------------------------------

    def local_variance(self, k: ArrayLike, t: float) -> tuple[NDArray[np.float64], int]:
        """Dupire local variance at log-moneyness k and maturity t; also returns clipped count."""
        kk = np.asarray(k, dtype=float)
        t = max(t, 1e-4)
        h = min(1e-3, 0.25 * t)
        w = np.maximum(self.total_variance(kk, t), 1e-10)
        dw_dt = (self.total_variance(kk, t + h) - self.total_variance(kk, max(t - h, 1e-6))) / (
            t + h - max(t - h, 1e-6)
        )
        # k-derivatives of the interpolated surface: interpolate the slices' analytic ones.
        w_k, w_kk = self._k_derivatives(kk, t)
        denominator = (
            1 - kk * w_k / w + 0.25 * (-0.25 - 1 / w + kk * kk / (w * w)) * w_k**2 + 0.5 * w_kk
        )
        local = dw_dt / denominator
        invalid = ~np.isfinite(local) | (local <= 0) | (denominator <= 0)
        local = np.where(invalid, w / t, local)  # fall back to implied variance where undefined
        return local, int(invalid.sum())

    def _k_derivatives(
        self, k: NDArray[np.float64], t: float
    ) -> tuple[NDArray[np.float64], NDArray[np.float64]]:
        ts, slices = self._t, self.slices
        if t <= ts[0] or t >= ts[-1]:
            edge = slices[0] if t <= ts[0] else slices[-1]
            scale = t / edge.t
            return (
                edge.fit.params.first_derivative(k) * scale,
                edge.fit.params.second_derivative(k) * scale,
            )
        i = int(np.searchsorted(ts, t)) - 1
        weight = (t - ts[i]) / (ts[i + 1] - ts[i])
        p0, p1 = slices[i].fit.params, slices[i + 1].fit.params
        return (
            (1 - weight) * p0.first_derivative(k) + weight * p1.first_derivative(k),
            (1 - weight) * p0.second_derivative(k) + weight * p1.second_derivative(k),
        )

    def local_vol(self, spots: ArrayLike, t: float) -> NDArray[np.float64]:
        s = np.asarray(spots, dtype=float)
        k = np.log(s / self.forward(max(t, 1e-4)))
        variance, _ = self.local_variance(k, t)
        return np.sqrt(np.clip(variance, 1e-6, 25.0))

    def local_vol_model(self) -> LocalVol:
        return LocalVol(self.local_vol, "Dupire local volatility from SVI surface")


def build_surface(data: SurfaceData) -> VolSurface:
    """Fit SVI to every cleaned expiry and assemble the surface."""
    slices = [
        SurfaceSlice(
            sl.t,
            sl.forward,
            sl.discount,
            fit_svi([p.log_moneyness for p in sl.points], [p.implied_vol for p in sl.points], sl.t),
        )
        for sl in data.slices
    ]
    return VolSurface(data.spot, slices)
