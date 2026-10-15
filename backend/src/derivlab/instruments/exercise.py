"""When the holder may exercise. Expiry is in years from today."""

import math
from dataclasses import dataclass


def _check_expiry(expiry: float) -> None:
    if not math.isfinite(expiry) or expiry < 0:
        raise ValueError("expiry must be finite and non-negative")


@dataclass(frozen=True)
class European:
    """Exercise only at expiry."""

    expiry: float

    def __post_init__(self) -> None:
        _check_expiry(self.expiry)


@dataclass(frozen=True)
class American:
    """Exercise at any time up to and including expiry."""

    expiry: float

    def __post_init__(self) -> None:
        _check_expiry(self.expiry)


Exercise = European | American
