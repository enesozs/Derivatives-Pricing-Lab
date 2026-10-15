"""SABR stochastic volatility for a forward, priced through Hagan's implied-vol approximation.

    dF = alpha F^beta dW1,   d alpha = nu alpha dW2,   corr(dW1, dW2) = rho

SABR is mainly used as a smile *interpolator*: per expiry, `alpha` sets the level, `rho` the
skew and `nu` (vol of vol) the curvature; `beta` (usually fixed, 0.5 or 1) sets the backbone,
i.e. how the smile moves with the forward. Hagan's formula gives a Black implied volatility
in closed form; it loses accuracy for very long expiries and far wings, and can imply
negative densities there.
Reference: Hagan, Kumar, Lesniewski & Woodward (2002), "Managing Smile Risk", Wilmott.
"""

import math
from dataclasses import dataclass

import numpy as np
from numpy.typing import ArrayLike, NDArray


@dataclass(frozen=True)
class SABR:
    alpha: float
    beta: float
    rho: float
    nu: float

    def __post_init__(self) -> None:
        if not all(math.isfinite(v) for v in (self.alpha, self.beta, self.rho, self.nu)):
            raise ValueError("SABR parameters must be finite")
        if self.alpha <= 0 or self.nu < 0:
            raise ValueError("alpha must be positive and nu non-negative")
        if not 0 <= self.beta <= 1:
            raise ValueError("beta must be in [0, 1]")
        if not -1 < self.rho < 1:
            raise ValueError("rho must be strictly between -1 and 1")

    def implied_volatility(
        self, forward: float, strike: ArrayLike, t: float
    ) -> NDArray[np.float64]:
        """Hagan et al. (2002) lognormal implied volatility, eq. (2.17a)."""
        k = np.asarray(strike, dtype=float)
        a, b, r, n = self.alpha, self.beta, self.rho, self.nu
        one_b = 1 - b
        fk = forward * k
        log_fk = np.log(forward / k)
        fk_beta = fk ** (one_b / 2)
        z = (n / a) * fk_beta * log_fk
        # x(z) with its z -> 0 limit handled explicitly.
        sqrt_term = np.sqrt(1 - 2 * r * z + z * z)
        with np.errstate(divide="ignore", invalid="ignore"):
            x = np.log((sqrt_term + z - r) / (1 - r))
            z_over_x = np.where(np.abs(z) < 1e-8, 1.0 - 0.5 * r * z, z / x)
        denominator = fk_beta * (1 + one_b**2 / 24 * log_fk**2 + one_b**4 / 1920 * log_fk**4)
        correction = (
            1
            + (
                one_b**2 / 24 * a * a / fk**one_b
                + 0.25 * r * b * n * a / fk_beta
                + (2 - 3 * r * r) / 24 * n * n
            )
            * t
        )
        return a / denominator * z_over_x * correction
