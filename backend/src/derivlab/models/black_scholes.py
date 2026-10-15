"""Black–Scholes: geometric Brownian motion with constant volatility."""

import math
from dataclasses import dataclass

import numpy as np
from numpy.typing import NDArray


@dataclass(frozen=True)
class BlackScholes:
    """dS/S = (r - q) dt + sigma dW under the risk-neutral measure.

    Volatility is an annualised decimal (0.20 = 20%).
    """

    volatility: float

    def __post_init__(self) -> None:
        if not math.isfinite(self.volatility) or self.volatility < 0:
            raise ValueError("volatility must be finite and non-negative")

    def characteristic_function(
        self, u: NDArray[np.complex128], t: float, rate: float, dividend_yield: float
    ) -> NDArray[np.complex128]:
        """E[exp(i u X)] for the log-return X = ln(S_t / S_0)."""
        drift = rate - dividend_yield - 0.5 * self.volatility**2
        return np.exp(1j * u * drift * t - 0.5 * self.volatility**2 * u * u * t)
