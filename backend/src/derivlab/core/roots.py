"""Typed wrapper around SciPy's Brent root finder (its stubs say it may return a tuple)."""

from collections.abc import Callable
from typing import cast

from scipy.optimize import brentq


def find_root(f: Callable[[float], float], low: float, high: float, xtol: float = 1e-12) -> float:
    """The x in [low, high] with f(x) = 0; f(low) and f(high) must have opposite signs."""
    return float(cast(float, brentq(f, low, high, xtol=xtol)))
