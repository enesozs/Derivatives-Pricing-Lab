"""Exotic options: payoffs that depend on more than the final price, or have unusual shapes.

Every exotic here is European-style and knows how to compute its payoff from simulated paths,
`payoff_paths(paths, times)`, so the Monte Carlo engine can price any of them under any model.
Closed forms (Black–Scholes only) live in engines/analytic/exotics.py.

Monitoring: barriers and lookbacks watch the price either continuously (the textbook/analytic
case) or at `observations` equally spaced dates (what real contracts specify). Discrete
monitoring with fewer dates makes a barrier harder to hit and a lookback's extreme less extreme.
"""

import math
from dataclasses import dataclass, replace
from typing import Literal

import numpy as np
from numpy.typing import ArrayLike, NDArray

from .payoffs import OptionKind, PlainVanilla


def _check(kind: str, expiry: float) -> None:
    if kind not in ("call", "put"):
        raise ValueError("kind must be 'call' or 'put'")
    if not math.isfinite(expiry) or expiry <= 0:
        raise ValueError("expiry must be positive")


def _observation_indices(steps: int, observations: int) -> NDArray[np.intp]:
    """Grid indices of `observations` equally spaced dates (excluding today, including expiry)."""
    if steps % observations:
        raise ValueError("the path grid must contain every observation date")
    stride = steps // observations
    return np.arange(stride, steps + 1, stride)


@dataclass(frozen=True)
class DigitalOption:
    """Pays `cash` (cash-or-nothing) or the asset itself (asset-or-nothing) if in the money."""

    kind: OptionKind
    strike: float
    expiry: float
    payout: Literal["cash", "asset"] = "cash"
    cash: float = 1.0

    def __post_init__(self) -> None:
        _check(self.kind, self.expiry)
        if self.strike <= 0 or self.cash <= 0:
            raise ValueError("strike and cash amount must be positive")

    @property
    def sign(self) -> int:
        return 1 if self.kind == "call" else -1

    def payoff(self, spot: ArrayLike) -> NDArray[np.float64]:
        s = np.asarray(spot, dtype=float)
        itm = self.sign * (s - self.strike) > 0
        return np.where(itm, self.cash if self.payout == "cash" else s, 0.0)

    def payoff_paths(
        self, paths: NDArray[np.float64], times: NDArray[np.float64]
    ) -> NDArray[np.float64]:
        return self.payoff(paths[:, -1])

    def with_expiry(self, expiry: float) -> "DigitalOption":
        return replace(self, expiry=expiry)


@dataclass(frozen=True)
class BarrierOption:
    """A vanilla call/put that is switched on (knock-in) or off (knock-out) if the price ever
    touches `barrier` from above (down) or below (up). In–out parity: in + out = vanilla."""

    kind: OptionKind
    strike: float
    expiry: float
    barrier: float
    direction: Literal["up", "down"]
    knock: Literal["in", "out"]
    #: None = continuous monitoring; otherwise the number of equally spaced observation dates.
    observations: int | None = None

    def __post_init__(self) -> None:
        _check(self.kind, self.expiry)
        if self.strike <= 0 or self.barrier <= 0:
            raise ValueError("strike and barrier must be positive")
        if self.direction not in ("up", "down") or self.knock not in ("in", "out"):
            raise ValueError("direction must be up/down and knock in/out")
        if self.observations is not None and self.observations < 1:
            raise ValueError("observations must be at least 1")

    @property
    def vanilla(self) -> PlainVanilla:
        return PlainVanilla(self.kind, self.strike)

    @property
    def label(self) -> str:
        return f"{self.direction}-and-{self.knock} {self.kind}"

    def breached(self, spot: ArrayLike) -> NDArray[np.bool_]:
        s = np.asarray(spot, dtype=float)
        return s >= self.barrier if self.direction == "up" else s <= self.barrier

    def hit_on_grid(self, paths: NDArray[np.float64]) -> NDArray[np.bool_]:
        """Whether each path touches the barrier at its monitored grid points."""
        if self.observations is None:
            monitored = paths
        else:
            monitored = paths[:, _observation_indices(paths.shape[1] - 1, self.observations)]
            monitored = np.concatenate([paths[:, :1], monitored], axis=1)
        return self.breached(monitored).any(axis=1)

    def payoff_given_hit(
        self, terminal: NDArray[np.float64], hit: NDArray[np.bool_]
    ) -> NDArray[np.float64]:
        alive = hit if self.knock == "in" else ~hit
        return np.where(alive, self.vanilla(terminal), 0.0)

    def payoff_paths(
        self, paths: NDArray[np.float64], times: NDArray[np.float64]
    ) -> NDArray[np.float64]:
        return self.payoff_given_hit(paths[:, -1], self.hit_on_grid(paths))

    def with_expiry(self, expiry: float) -> "BarrierOption":
        return replace(self, expiry=expiry)


@dataclass(frozen=True)
class AsianOption:
    """Pays on the average price over `fixings` equally spaced dates (the last at expiry).

    Fixed strike: max(phi (A - K), 0). Floating strike: max(phi (S_T - A), 0).
    Averaging smooths the payoff, so Asians are cheaper than vanillas and hard to manipulate,
    which is why they are common on commodities and FX.
    """

    kind: OptionKind
    strike: float
    expiry: float
    fixings: int = 12
    averaging: Literal["arithmetic", "geometric"] = "arithmetic"
    strike_type: Literal["fixed", "floating"] = "fixed"

    def __post_init__(self) -> None:
        _check(self.kind, self.expiry)
        if self.strike_type == "fixed" and self.strike <= 0:
            raise ValueError("strike must be positive")
        if self.fixings < 1:
            raise ValueError("need at least one fixing")

    @property
    def sign(self) -> int:
        return 1 if self.kind == "call" else -1

    def fixing_times(self) -> NDArray[np.float64]:
        return self.expiry * np.arange(1, self.fixings + 1) / self.fixings

    def average(self, paths: NDArray[np.float64]) -> NDArray[np.float64]:
        fixed = paths[:, _observation_indices(paths.shape[1] - 1, self.fixings)]
        if self.averaging == "geometric":
            return np.exp(np.log(fixed).mean(axis=1))
        return fixed.mean(axis=1)

    def payoff_paths(
        self, paths: NDArray[np.float64], times: NDArray[np.float64]
    ) -> NDArray[np.float64]:
        average = self.average(paths)
        if self.strike_type == "fixed":
            return np.maximum(self.sign * (average - self.strike), 0.0)
        return np.maximum(self.sign * (paths[:, -1] - average), 0.0)

    def with_expiry(self, expiry: float) -> "AsianOption":
        return replace(self, expiry=expiry)


@dataclass(frozen=True)
class LookbackOption:
    """Pays on the best price seen over the option's life.

    Floating strike: call max(S_T - min S, 0) = buy at the lowest price; put max S - S_T.
    Fixed strike: call max(max S - K, 0); put max(K - min S, 0).
    """

    kind: OptionKind
    expiry: float
    strike_type: Literal["fixed", "floating"] = "floating"
    strike: float = 100.0
    #: None = continuous monitoring; otherwise the number of equally spaced observation dates.
    observations: int | None = None

    def __post_init__(self) -> None:
        _check(self.kind, self.expiry)
        if self.strike_type == "fixed" and self.strike <= 0:
            raise ValueError("strike must be positive")

    @property
    def sign(self) -> int:
        return 1 if self.kind == "call" else -1

    def extremes(
        self, paths: NDArray[np.float64]
    ) -> tuple[NDArray[np.float64], NDArray[np.float64]]:
        if self.observations is None:
            monitored = paths
        else:
            idx = _observation_indices(paths.shape[1] - 1, self.observations)
            monitored = np.concatenate([paths[:, :1], paths[:, idx]], axis=1)
        return monitored.min(axis=1), monitored.max(axis=1)

    def payoff_from_extremes(
        self, terminal: NDArray[np.float64], low: NDArray[np.float64], high: NDArray[np.float64]
    ) -> NDArray[np.float64]:
        if self.strike_type == "floating":
            return terminal - low if self.kind == "call" else high - terminal
        if self.kind == "call":
            return np.maximum(high - self.strike, 0.0)
        return np.maximum(self.strike - low, 0.0)

    def payoff_paths(
        self, paths: NDArray[np.float64], times: NDArray[np.float64]
    ) -> NDArray[np.float64]:
        low, high = self.extremes(paths)
        return self.payoff_from_extremes(paths[:, -1], low, high)

    def with_expiry(self, expiry: float) -> "LookbackOption":
        return replace(self, expiry=expiry)


Exotic = DigitalOption | BarrierOption | AsianOption | LookbackOption
