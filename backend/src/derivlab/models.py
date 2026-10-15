"""Models describe how the underlying is assumed to move (risk-neutral dynamics)."""

import math
from dataclasses import dataclass


@dataclass(frozen=True)
class BlackScholes:
    """Geometric Brownian motion: dS/S = (r - q) dt + sigma dW under the risk-neutral measure.

    Volatility is an annualised decimal (0.20 = 20%).
    """

    volatility: float

    def __post_init__(self) -> None:
        if not math.isfinite(self.volatility) or self.volatility < 0:
            raise ValueError("volatility must be finite and non-negative")
