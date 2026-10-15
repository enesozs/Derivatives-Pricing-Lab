"""Heston stochastic volatility.

    dS/S = (r - q) dt + sqrt(v) dW1
    dv   = kappa (theta - v) dt + xi sqrt(v) dW2,     corr(dW1, dW2) = rho

Variance v mean-reverts to `theta` at speed `kappa`; `xi` is the volatility of variance; `rho`
(usually negative for equities) makes volatility rise when the price falls, which tilts the
smile into a skew. `v0` is today's variance. The Feller condition 2 kappa theta > xi^2 keeps v
strictly positive; it is often violated by calibrated parameters, which is fine for Fourier
pricing but matters for simulation.

Reference: Heston (1993); characteristic function in the "little trap" form of
Albrecher, Mayer, Schoutens & Tistaert (2007), which avoids branch-cut discontinuities.
"""

import math
from dataclasses import dataclass

import numpy as np
from numpy.typing import NDArray


@dataclass(frozen=True)
class Heston:
    v0: float
    kappa: float
    theta: float
    xi: float
    rho: float

    def __post_init__(self) -> None:
        values = (self.v0, self.kappa, self.theta, self.xi, self.rho)
        if not all(math.isfinite(v) for v in values):
            raise ValueError("Heston parameters must be finite")
        if self.v0 < 0 or self.theta < 0:
            raise ValueError("v0 and theta must be non-negative")
        if self.kappa <= 0 or self.xi <= 0:
            raise ValueError("kappa and xi must be positive")
        if not -1 < self.rho < 1:
            raise ValueError("rho must be strictly between -1 and 1")

    @property
    def feller_satisfied(self) -> bool:
        return 2 * self.kappa * self.theta > self.xi**2

    def characteristic_function(
        self, u: NDArray[np.complex128], t: float, rate: float, dividend_yield: float
    ) -> NDArray[np.complex128]:
        """E[exp(i u X)] for the log-return X = ln(S_t / S_0)."""
        kappa, theta, xi, rho = self.kappa, self.theta, self.xi, self.rho
        iu = 1j * u
        beta = kappa - rho * xi * iu
        d = np.sqrt(beta * beta + xi * xi * (iu + u * u))
        g = (beta - d) / (beta + d)
        exp_dt = np.exp(-d * t)
        c = (rate - dividend_yield) * iu * t + (kappa * theta / xi**2) * (
            (beta - d) * t - 2 * np.log((1 - g * exp_dt) / (1 - g))
        )
        big_d = ((beta - d) / xi**2) * (1 - exp_dt) / (1 - g * exp_dt)
        return np.exp(c + big_d * self.v0)
