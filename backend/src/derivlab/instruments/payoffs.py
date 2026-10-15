"""Payoff functions, defined once and evaluated by every engine on NumPy arrays."""

import math
from dataclasses import dataclass
from typing import Literal

import numpy as np
from numpy.typing import ArrayLike, NDArray

OptionKind = Literal["call", "put"]


@dataclass(frozen=True)
class PlainVanilla:
    """max(S - K, 0) for a call, max(K - S, 0) for a put."""

    kind: OptionKind
    strike: float

    def __post_init__(self) -> None:
        if self.kind not in ("call", "put"):
            raise ValueError("kind must be 'call' or 'put'")
        if not math.isfinite(self.strike) or self.strike <= 0:
            raise ValueError("strike must be finite and positive")

    @property
    def sign(self) -> int:
        return 1 if self.kind == "call" else -1

    def __call__(self, spot: ArrayLike) -> NDArray[np.float64]:
        s = np.asarray(spot, dtype=float)
        return np.maximum(self.sign * (s - self.strike), 0.0)
