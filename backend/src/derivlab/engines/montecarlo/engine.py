"""Risk-neutral Monte Carlo for European options, with variance reduction.

Value = mean of discounted payoffs over simulated paths.
Error: statistical, O(1/sqrt(paths)); reported as a standard error.
- Antithetic variates pair each path with its mirror image; the standard error is computed
  from pair averages, because the two halves are not independent.
- Control variate: the discounted terminal spot, whose expectation S*exp(-qT) is known
  exactly. The regression coefficient is estimated from the same sample (small bias, O(1/n)).

Greeks are estimated from the same paths (no re-simulation):
- Pathwise (delta, vega, rho, theta): differentiate each path's discounted payoff with respect
  to the parameter. Valid because the vanilla payoff is continuous in S_T.
- Likelihood ratio (gamma): the payoff's second derivative is a spike at the strike, so instead
  differentiate the density of S_T: gamma = E[disc * payoff * (Z^2 - 1 - Z sigma sqrt(T))]
  / (S0^2 sigma^2 T). Unbiased but noticeably noisier, which the UI makes visible.
Reference: Glasserman, Monte Carlo Methods in Financial Engineering, ch. 4 and 7.
"""

import math
from dataclasses import dataclass

import numpy as np
from numpy.typing import NDArray

from derivlab.core.errors import UnsupportedError
from derivlab.instruments import Instrument, VanillaOption
from derivlab.market import Market
from derivlab.models import BlackScholes, Model
from derivlab.results import Greeks, PricingResult

from .exotics import ExoticSettings, price_exotic
from .paths import DISCRETISED_MODELS, simulate_paths


@dataclass(frozen=True)
class MonteCarloEngine:
    paths: int = 100_000
    steps: int = 1
    seed: int = 42
    antithetic: bool = True
    control_variate: bool = True
    greeks: bool = True
    #: Minimum time steps per year for models without an exact transition (Heston, local vol).
    steps_per_year: int = 100

    def price(self, option: Instrument, market: Market, model: Model) -> PricingResult:
        if not isinstance(option, VanillaOption):
            settings = ExoticSettings(
                self.paths, self.seed, self.antithetic, self.control_variate, self.steps_per_year
            )
            return price_exotic(option, market, model, settings)
        if option.is_american:
            raise UnsupportedError(
                "Monte Carlo cannot price early exercise yet (Longstaff–Schwartz is Phase 3)"
            )
        t = option.expiry
        if t == 0:
            return PricingResult(float(option.payoff(market.spot)), stderr=0.0)

        rng = np.random.default_rng(self.seed)
        steps = self.steps
        if isinstance(model, DISCRETISED_MODELS):
            steps = max(steps, math.ceil(self.steps_per_year * t))
        spots = simulate_paths(market, model, t, steps, self.paths, rng, self.antithetic)
        terminal = spots[:, -1]
        discount = market.discount(t)
        samples = discount * option.payoff(terminal)

        greeks = (
            self._greeks(option, market, model, terminal, samples)
            if self.greeks and isinstance(model, BlackScholes) and model.volatility > 0
            else None
        )

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
            greeks=greeks,
            diagnostics={"paths": self.paths, "steps": steps, "seed": self.seed},
        )

    @staticmethod
    def _greeks(
        option: VanillaOption,
        market: Market,
        model: BlackScholes,
        terminal: NDArray[np.float64],
        discounted_payoff: NDArray[np.float64],
    ) -> Greeks:
        s0, t, sigma = market.spot, option.expiry, model.volatility
        r, q = market.rate, market.dividend_yield
        discount = market.discount(t)
        sign = option.payoff.sign
        # d(payoff)/d(S_T): +1 for an in-the-money call, -1 for an in-the-money put, else 0.
        slope = discount * sign * (sign * (terminal - option.payoff.strike) > 0)
        log_return = np.log(terminal / s0)
        z = (log_return - (r - q - 0.5 * sigma**2) * t) / (sigma * math.sqrt(t))

        delta = slope * terminal / s0
        vega = slope * terminal * (log_return - (r - q + 0.5 * sigma**2) * t) / sigma
        gamma = discounted_payoff * (z * z - 1 - z * sigma * math.sqrt(t)) / (s0**2 * sigma**2 * t)
        rho = -t * discounted_payoff + slope * terminal * t
        d_terminal_dt = terminal * ((r - q - 0.5 * sigma**2) + sigma * z / (2 * math.sqrt(t)))
        theta = r * discounted_payoff - slope * d_terminal_dt  # theta = -dV/dT
        return Greeks(*(float(np.mean(g)) for g in (delta, gamma, vega, theta, rho)))
