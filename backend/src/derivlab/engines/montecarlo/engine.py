"""Risk-neutral Monte Carlo for European options, with variance reduction.

Value = mean of discounted payoffs over simulated paths.
Error: statistical, O(1/sqrt(paths)); reported as a standard error.
- Antithetic variates pair each path with its mirror image; the standard error is computed
  from pair averages, because the two halves are not independent.
- Control variate: the discounted terminal spot, whose expectation S*exp(-qT) is known
  exactly. The regression coefficient is estimated from the same sample (small bias, O(1/n)).
Reference: Glasserman, Monte Carlo Methods in Financial Engineering, ch. 4.
"""

import math
from dataclasses import dataclass

import numpy as np

from derivlab.core.errors import UnsupportedError
from derivlab.instruments import VanillaOption
from derivlab.market import Market
from derivlab.models import BlackScholes
from derivlab.results import PricingResult

from .paths import gbm_paths


@dataclass(frozen=True)
class MonteCarloEngine:
    paths: int = 100_000
    steps: int = 1
    seed: int = 42
    antithetic: bool = True
    control_variate: bool = True

    def price(self, option: VanillaOption, market: Market, model: BlackScholes) -> PricingResult:
        if option.is_american:
            raise UnsupportedError(
                "Monte Carlo cannot price early exercise yet (Longstaff–Schwartz is Phase 3)"
            )
        t = option.expiry
        if t == 0:
            return PricingResult(float(option.payoff(market.spot)), stderr=0.0)

        rng = np.random.default_rng(self.seed)
        spots = gbm_paths(market, model, t, self.steps, self.paths, rng, self.antithetic)
        terminal = spots[:, -1]
        discount = market.discount(t)
        samples = discount * option.payoff(terminal)

        if self.control_variate:
            control = discount * terminal
            control_mean = market.spot * math.exp(-market.dividend_yield * t)
            control_var = np.var(control, ddof=1)
            if control_var > 0:
                beta = np.cov(samples, control, ddof=1)[0, 1] / control_var
                samples = samples - beta * (control - control_mean)

        if self.antithetic:
            half = self.paths // 2
            independent = 0.5 * (samples[:half] + samples[half:])
        else:
            independent = samples
        stderr = float(np.std(independent, ddof=1) / math.sqrt(len(independent)))

        return PricingResult(
            float(np.mean(samples)),
            stderr=stderr,
            diagnostics={"paths": self.paths, "steps": self.steps, "seed": self.seed},
        )
