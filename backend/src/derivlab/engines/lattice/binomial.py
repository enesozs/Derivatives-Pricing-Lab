"""Binomial trees for European and American vanilla options, with three parametrisations.

A recombining tree: over each step dt the spot moves up by u or down by d, with risk-neutral
probability p chosen so the discounted spot is a martingale: p = (exp((r-q)dt) - d) / (u - d).

Schemes (how u, d and p are chosen):
- "crr" (Cox–Ross–Rubinstein): u = exp(sigma*sqrt(dt)), d = 1/u. Error O(1/N) and it zig-zags
  between odd and even N, because the strike falls at different spots relative to the nodes.
- "jarrow-rudd": equal-probability tree, u,d = exp((r - q - sigma^2/2)dt +/- sigma*sqrt(dt)).
  Same order as CRR; the tree drifts with the forward instead of being centred on today's spot.
- "leisen-reimer": u, d and p come from inverting the Black–Scholes d1 and d2 with the
  Peizer–Pratt normal approximation, so the tree's terminal distribution is centred on the
  strike. Converges at O(1/N^2) for European options with no oscillation. Needs odd N; even
  values are bumped up by one.

Greeks: delta, gamma and theta are read off the first two levels of the tree (no extra runs);
vega and rho are central bumps of the whole tree. In the Jarrow–Rudd tree the node positions
depend on r and sigma, so bumping them also shifts nodes relative to the strike and the bumped
Greeks pick up some discretisation noise.
References: Hull ch. 13 and 21; Leisen & Reimer (1996), Applied Mathematical Finance 3(4).
"""

import math
from dataclasses import dataclass, replace
from typing import Literal

import numpy as np
from numpy.typing import NDArray

from derivlab.core.errors import UnsupportedError
from derivlab.instruments import VanillaOption
from derivlab.market import Market
from derivlab.models import BlackScholes, Model
from derivlab.results import Greeks, PricingResult

Scheme = Literal["crr", "jarrow-rudd", "leisen-reimer"]

SCHEME_LABELS: dict[Scheme, str] = {
    "crr": "CRR",
    "jarrow-rudd": "Jarrow–Rudd",
    "leisen-reimer": "Leisen–Reimer",
}

_VOL_BUMP = 1e-3
_RATE_BUMP = 1e-4


@dataclass(frozen=True)
class TreeParameters:
    steps: int
    dt: float
    up: float
    down: float
    probability: float
    discount: float


def _peizer_pratt(z: float, n: int) -> float:
    """Peizer–Pratt method 2: binomial probability approximating the normal cdf at z."""
    if z == 0:
        return 0.5
    term = z / (n + 1 / 3 + 0.1 / (n + 1))
    return 0.5 + math.copysign(0.5, z) * math.sqrt(1 - math.exp(-term * term * (n + 1 / 6)))


def tree_parameters(
    option: VanillaOption, market: Market, model: BlackScholes, steps: int, scheme: Scheme
) -> TreeParameters:
    t, sigma = option.expiry, model.volatility
    if scheme == "leisen-reimer" and steps % 2 == 0:
        steps += 1
    dt = t / steps
    growth = math.exp((market.rate - market.dividend_yield) * dt)

    if scheme == "crr":
        up = math.exp(sigma * math.sqrt(dt))
        down = 1 / up
    elif scheme == "jarrow-rudd":
        mu = (market.rate - market.dividend_yield - 0.5 * sigma**2) * dt
        up = math.exp(mu + sigma * math.sqrt(dt))
        down = math.exp(mu - sigma * math.sqrt(dt))
    else:
        width = sigma * math.sqrt(t)
        d1 = (
            math.log(market.spot / option.payoff.strike)
            + (market.rate - market.dividend_yield + 0.5 * sigma**2) * t
        ) / width
        d2 = d1 - width
        p, p_prime = _peizer_pratt(d2, steps), _peizer_pratt(d1, steps)
        if not 0 < p < 1:
            # Happens when sigma*sqrt(T) is tiny next to log-moneyness: the tree degenerates.
            raise ValueError("Leisen–Reimer tree is degenerate at this volatility")
        up = growth * p_prime / p
        down = (growth - p * up) / (1 - p)

    probability = (growth - down) / (up - down)
    if not 0 <= probability <= 1:
        raise ValueError(
            f"risk-neutral probability {probability:.4f} is outside [0, 1]; increase the steps"
        )
    return TreeParameters(steps, dt, up, down, probability, math.exp(-market.rate * dt))


def _level_spots(spot: float, tree: TreeParameters, level: int) -> NDArray[np.float64]:
    """Spots at one level: spot * u^j * d^(level - j) for j = 0..level."""
    j = np.arange(level + 1)
    return spot * np.exp(level * math.log(tree.down) + j * math.log(tree.up / tree.down))


def roll_back(
    option: VanillaOption,
    spot: float,
    tree: TreeParameters,
    keep: int = 2,
) -> list[tuple[NDArray[np.float64], NDArray[np.float64], NDArray[np.bool_]]]:
    """Backward induction. Returns (spots, values, exercised) for levels 0..keep."""
    n = tree.steps
    p, discount = tree.probability, tree.discount
    values = option.payoff(_level_spots(spot, tree, n))
    kept: list[tuple[NDArray[np.float64], NDArray[np.float64], NDArray[np.bool_]]] = [
        (np.empty(0), np.empty(0), np.empty(0, dtype=bool))
    ] * (keep + 1)
    if n <= keep:
        kept[n] = (_level_spots(spot, tree, n), values, np.zeros(n + 1, dtype=bool))
    for m in range(n - 1, -1, -1):
        values = discount * (p * values[1:] + (1 - p) * values[:-1])
        exercised = np.zeros(m + 1, dtype=bool)
        if option.is_american or m <= keep:
            spots = _level_spots(spot, tree, m)
            if option.is_american:
                intrinsic = option.payoff(spots)
                exercised = intrinsic > values + 1e-12
                values = np.where(exercised, intrinsic, values)
            if m <= keep:
                kept[m] = (spots, values, exercised)
    return kept


@dataclass(frozen=True)
class BinomialEngine:
    steps: int = 500
    scheme: Scheme = "crr"
    #: Skip Greeks (saves four extra tree runs) when only the value is needed.
    greeks: bool = True

    def __post_init__(self) -> None:
        if self.steps < 3:
            raise ValueError("a binomial tree needs at least 3 steps")
        if self.scheme not in SCHEME_LABELS:
            raise ValueError(f"unknown scheme {self.scheme!r}")

    @property
    def label(self) -> str:
        return f"{SCHEME_LABELS[self.scheme]} tree · {self.steps:,} steps"

    def _value(self, option: VanillaOption, market: Market, model: BlackScholes) -> float:
        tree = tree_parameters(option, market, model, self.steps, self.scheme)
        return float(roll_back(option, market.spot, tree, keep=0)[0][1][0])

    def price(self, option: VanillaOption, market: Market, model: Model) -> PricingResult:
        if not isinstance(model, BlackScholes):
            raise UnsupportedError(
                f"Binomial trees here assume Black–Scholes dynamics, not {type(model).__name__}"
            )
        if option.expiry == 0:
            return PricingResult(float(option.payoff(market.spot)))
        if model.volatility == 0:
            raise ValueError("a binomial tree needs positive volatility")

        tree = tree_parameters(option, market, model, self.steps, self.scheme)
        if not self.greeks:
            value = roll_back(option, market.spot, tree, keep=0)[0][1][0]
            return PricingResult(float(value), diagnostics={"steps": tree.steps})
        (_, v0, _), (s1, v1, _), (s2, v2, _) = roll_back(option, market.spot, tree, keep=2)
        delta = (v1[1] - v1[0]) / (s1[1] - s1[0])
        up_slope = (v2[2] - v2[1]) / (s2[2] - s2[1])
        down_slope = (v2[1] - v2[0]) / (s2[1] - s2[0])
        gamma = (up_slope - down_slope) / (0.5 * (s2[2] - s2[0]))
        # The middle node two steps ahead sits at (or, for drifting trees, near) today's spot.
        # Remove the part of its value change caused by the spot offset, leaving time decay.
        offset = s2[1] - market.spot
        theta = (v2[1] - delta * offset - 0.5 * gamma * offset**2 - v0[0]) / (2 * tree.dt)

        h = min(_VOL_BUMP, model.volatility / 2)
        vega = (
            self._value(option, market, replace(model, volatility=model.volatility + h))
            - self._value(option, market, replace(model, volatility=model.volatility - h))
        ) / (2 * h)
        rho = (
            self._value(option, replace(market, rate=market.rate + _RATE_BUMP), model)
            - self._value(option, replace(market, rate=market.rate - _RATE_BUMP), model)
        ) / (2 * _RATE_BUMP)

        return PricingResult(
            float(v0[0]),
            greeks=Greeks(float(delta), float(gamma), vega, float(theta), rho),
            diagnostics={"steps": tree.steps, "scheme": self.scheme},
        )


@dataclass(frozen=True)
class TreeNode:
    level: int
    index: int
    spot: float
    value: float
    exercised: bool


def tree_nodes(
    option: VanillaOption,
    market: Market,
    model: BlackScholes,
    steps: int,
    scheme: Scheme = "crr",
) -> tuple[TreeParameters, list[TreeNode]]:
    """Every node of a small tree, for visualisation (at most 12 steps)."""
    if not 1 <= steps <= 12:
        raise ValueError("tree visualisation supports 1 to 12 steps")
    if option.expiry <= 0 or model.volatility <= 0:
        raise ValueError("tree visualisation needs positive expiry and volatility")
    tree = tree_parameters(option, market, model, steps, scheme)
    levels = roll_back(option, market.spot, tree, keep=tree.steps)
    nodes = [
        TreeNode(m, j, float(s), float(v), bool(e))
        for m, (spots, values, exercised) in enumerate(levels)
        for j, (s, v, e) in enumerate(zip(spots, values, exercised, strict=True))
    ]
    return tree, nodes
