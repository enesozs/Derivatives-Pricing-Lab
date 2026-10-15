"""Merton jump-diffusion: Black–Scholes plus occasional lognormal jumps.

    dS/S = (r - q - lambda k) dt + sigma dW + (J - 1) dN,    ln J ~ N(mu_j, sigma_j^2)

`intensity` (lambda) is the expected number of jumps per year; each jump multiplies the price
by J. The drift is compensated by lambda k, k = E[J - 1], so S stays a martingale after
discounting. Jumps fatten the tails, which steepens the smile most at short maturities, the
feature pure diffusions (including Heston) struggle to produce.
Reference: Merton (1976), J. Financial Economics 3.
"""

import math
from dataclasses import dataclass

import numpy as np
from numpy.typing import NDArray


@dataclass(frozen=True)
class Merton:
    volatility: float
    intensity: float
    jump_mean: float
    jump_volatility: float

    def __post_init__(self) -> None:
        values = (self.volatility, self.intensity, self.jump_mean, self.jump_volatility)
        if not all(math.isfinite(v) for v in values):
            raise ValueError("Merton parameters must be finite")
        if self.volatility < 0 or self.intensity < 0 or self.jump_volatility < 0:
            raise ValueError("volatility, intensity and jump volatility must be non-negative")

    @property
    def jump_compensator(self) -> float:
        """k = E[J - 1]."""
        return math.exp(self.jump_mean + 0.5 * self.jump_volatility**2) - 1

    def characteristic_function(
        self, u: NDArray[np.complex128], t: float, rate: float, dividend_yield: float
    ) -> NDArray[np.complex128]:
        """E[exp(i u X)] for the log-return X = ln(S_t / S_0)."""
        sigma, lam = self.volatility, self.intensity
        drift = rate - dividend_yield - lam * self.jump_compensator - 0.5 * sigma**2
        jump = np.exp(1j * u * self.jump_mean - 0.5 * self.jump_volatility**2 * u * u) - 1
        return np.exp(1j * u * drift * t - 0.5 * sigma**2 * u * u * t + lam * t * jump)
