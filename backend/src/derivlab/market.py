"""Observable market state today.

Rates and dividend yields are annualised, continuously compounded decimals.
A flat rate stands in for a discount curve until Phase 5 introduces curves.
"""

import math
from dataclasses import dataclass


@dataclass(frozen=True)
class Market:
    spot: float
    rate: float
    dividend_yield: float = 0.0

    def __post_init__(self) -> None:
        for name in ("spot", "rate", "dividend_yield"):
            if not math.isfinite(getattr(self, name)):
                raise ValueError(f"{name} must be finite")
        if self.spot <= 0:
            raise ValueError("spot must be positive")

    def discount(self, t: float) -> float:
        """Risk-free discount factor to time t (years)."""
        return math.exp(-self.rate * t)

    def forward(self, t: float) -> float:
        """Forward price of the underlying for delivery at time t."""
        return self.spot * math.exp((self.rate - self.dividend_yield) * t)
