"""Multi-asset payoffs. All European; `payoff(terminal)` takes spots of shape (paths, n)."""

from dataclasses import dataclass
from typing import Literal

import numpy as np
from numpy.typing import NDArray

from derivlab.instruments import OptionKind


def _sign(kind: OptionKind) -> int:
    if kind not in ("call", "put"):
        raise ValueError("kind must be 'call' or 'put'")
    return 1 if kind == "call" else -1


@dataclass(frozen=True)
class ExchangeOption:
    """The right to swap asset 2 for asset 1: max(S1 - S2, 0). Margrabe (1978) closed form."""

    expiry: float
    quantity_1: float = 1.0
    quantity_2: float = 1.0

    def payoff(self, terminal: NDArray[np.float64]) -> NDArray[np.float64]:
        return np.maximum(self.quantity_1 * terminal[:, 0] - self.quantity_2 * terminal[:, 1], 0.0)


@dataclass(frozen=True)
class SpreadOption:
    """Call: max(S1 - S2 - K, 0); put: max(K - (S1 - S2), 0). Kirk's (1995) approximation."""

    kind: OptionKind
    strike: float
    expiry: float

    def payoff(self, terminal: NDArray[np.float64]) -> NDArray[np.float64]:
        return np.maximum(_sign(self.kind) * (terminal[:, 0] - terminal[:, 1] - self.strike), 0.0)


@dataclass(frozen=True)
class BasketOption:
    """On a weighted sum of assets: max(phi (sum w_i S_i - K), 0)."""

    kind: OptionKind
    strike: float
    expiry: float
    weights: tuple[float, ...]

    def __post_init__(self) -> None:
        _sign(self.kind)
        if any(w < 0 for w in self.weights) or sum(self.weights) <= 0:
            raise ValueError("basket weights must be non-negative and not all zero")

    def basket(self, terminal: NDArray[np.float64]) -> NDArray[np.float64]:
        return terminal @ np.array(self.weights)

    def payoff(self, terminal: NDArray[np.float64]) -> NDArray[np.float64]:
        return np.maximum(_sign(self.kind) * (self.basket(terminal) - self.strike), 0.0)


@dataclass(frozen=True)
class RainbowOption:
    """On the best (max) or worst (min) of several assets: e.g. a best-of call max(max S_i - K, 0).

    Best-of options get *cheaper* as correlation rises (the assets diverge less), worst-of
    options get *dearer*: correlation is a first-order risk for both.
    """

    kind: OptionKind
    strike: float
    expiry: float
    style: Literal["best", "worst"] = "best"

    def payoff(self, terminal: NDArray[np.float64]) -> NDArray[np.float64]:
        extreme = terminal.max(axis=1) if self.style == "best" else terminal.min(axis=1)
        return np.maximum(_sign(self.kind) * (extreme - self.strike), 0.0)


@dataclass(frozen=True)
class QuantoOption:
    """A vanilla on a foreign asset, paid in domestic currency at a fixed exchange rate.

    Payoff in domestic currency: fixed_fx * max(phi (S_T - K), 0). Hedging it needs the FX rate
    too, and their correlation shifts the asset's drift (the "quanto adjustment").
    """

    kind: OptionKind
    strike: float
    expiry: float
    fixed_fx: float = 1.0

    @property
    def sign(self) -> int:
        return _sign(self.kind)
