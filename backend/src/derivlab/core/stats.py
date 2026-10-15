"""Scalar standard-normal helpers (math-only; faster than scipy.stats for scalars)."""

import math

_SQRT_2 = math.sqrt(2.0)
_SQRT_2PI = math.sqrt(2.0 * math.pi)


def norm_cdf(x: float) -> float:
    """Standard normal CDF, computed via erfc for accuracy in the tails."""
    return 0.5 * math.erfc(-x / _SQRT_2)


def norm_pdf(x: float) -> float:
    """Standard normal density."""
    return math.exp(-0.5 * x * x) / _SQRT_2PI
