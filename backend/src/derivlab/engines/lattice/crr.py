"""Cox–Ross–Rubinstein binomial tree for European and American vanilla options.

Model: GBM approximated by a recombining tree with u = exp(sigma*sqrt(dt)), d = 1/u and
risk-neutral up-probability p = (exp((r-q)dt) - d) / (u - d).
Error: O(1/N), oscillating between odd and even N because the strike falls at different
positions relative to the terminal nodes.
Greeks: delta, gamma and theta are read off the first two levels of the tree (no extra
pricing runs); vega and rho are central bumps of the whole tree.
Reference: Hull, ch. 13 and 21.
"""

import math
from dataclasses import dataclass, replace

import numpy as np
from numpy.typing import NDArray

from derivlab.instruments import VanillaOption
from derivlab.market import Market
from derivlab.models import BlackScholes
from derivlab.results import Greeks, PricingResult

_VOL_BUMP = 1e-3
_RATE_BUMP = 1e-4


@dataclass(frozen=True)
class CRREngine:
    steps: int = 500

    def __post_init__(self) -> None:
        if self.steps < 3:
            raise ValueError("CRR needs at least 3 steps")

    def price(self, option: VanillaOption, market: Market, model: BlackScholes) -> PricingResult:
        if option.expiry == 0:
            return PricingResult(float(option.payoff(market.spot)))
        if model.volatility == 0:
            raise ValueError("CRR tree needs positive volatility")

        levels = self._roll_back(option, market, model)
        dt = option.expiry / self.steps
        u = math.exp(model.volatility * math.sqrt(dt))
        s = market.spot
        v0, v1, v2 = levels[0][0], levels[1], levels[2]

        delta = (v1[1] - v1[0]) / (s * u - s / u)
        up_slope = (v2[2] - v2[1]) / (s * u * u - s)
        down_slope = (v2[1] - v2[0]) / (s - s / (u * u))
        gamma = (up_slope - down_slope) / (0.5 * (s * u * u - s / (u * u)))
        # The middle node two steps ahead has the same spot (u*d = 1), so the change is pure time.
        theta = (v2[1] - v0) / (2 * dt)

        greeks = Greeks(
            delta=float(delta),
            gamma=float(gamma),
            vega=self._bump(option, market, model, "volatility", _VOL_BUMP),
            theta=float(theta),
            rho=self._bump(option, market, model, "rate", _RATE_BUMP),
        )
        return PricingResult(float(v0), greeks=greeks, diagnostics={"steps": self.steps})

    def _bump(
        self, option: VanillaOption, market: Market, model: BlackScholes, field: str, h: float
    ) -> float:
        """Central difference of the tree price in `field` ("volatility" or "rate")."""
        if field == "volatility":
            h = min(h, model.volatility / 2)
            up = (market, replace(model, volatility=model.volatility + h))
            down = (market, replace(model, volatility=model.volatility - h))
        else:
            up = (replace(market, rate=market.rate + h), model)
            down = (replace(market, rate=market.rate - h), model)
        v_up = self._roll_back(option, *up)[0][0]
        v_down = self._roll_back(option, *down)[0][0]
        return float((v_up - v_down) / (2 * h))

    def _roll_back(
        self, option: VanillaOption, market: Market, model: BlackScholes
    ) -> dict[int, NDArray[np.float64]]:
        """Backward induction; returns option values at tree levels 0, 1 and 2."""
        n = self.steps
        dt = option.expiry / n
        log_u = model.volatility * math.sqrt(dt)
        u = math.exp(log_u)
        p = (math.exp((market.rate - market.dividend_yield) * dt) - 1 / u) / (u - 1 / u)
        if not 0 <= p <= 1:
            raise ValueError(
                f"CRR risk-neutral probability {p:.4f} is outside [0, 1]; increase the steps"
            )
        discount = math.exp(-market.rate * dt)

        # Every node price in the tree is spot * u^k for k in [-n, n]; level m uses every
        # other k in [-m, m], i.e. the slice [n - m : n + m + 1 : 2] of this grid.
        grid = market.spot * np.exp(np.arange(-n, n + 1) * log_u)
        exercise_value = option.payoff(grid)
        values = exercise_value[0::2]
        levels: dict[int, NDArray[np.float64]] = {}
        for m in range(n - 1, -1, -1):
            values = discount * (p * values[1:] + (1 - p) * values[:-1])
            if option.is_american:
                values = np.maximum(values, exercise_value[n - m : n + m + 1 : 2])
            if m <= 2:
                levels[m] = values
        return levels
