"""Variance and volatility swaps.

A variance swap pays N (sigma_R^2 - K_var) at maturity, where sigma_R^2 is the annualised
realised variance of daily log returns. Its fair strike is the expected realised variance.

**Replication** (Demeterfi, Derman, Kamal & Zou 1999). For a diffusion,
  realised variance = (2/T) [ integral of dS/S  -  ln(S_T / S_0) ],
and the log contract is a static strip of out-of-the-money options weighted by 1/K^2:
  K_var = (2 e^{rT} / T) [ integral_0^F P(K)/K^2 dK + integral_F^inf C(K)/K^2 dK ].
So a variance swap can be hedged with options on every strike plus a delta hedge; this is
how the VIX is computed. Low strikes get the most weight, so the put skew makes variance
expensive. With **jumps** the identity breaks: the log contract prices 2 E[e^J - 1 - J] per
jump rather than E[J^2], so replication and true expected variance differ.

A **volatility swap** pays sigma_R - K_vol. Because the square root is concave,
K_vol = E[sigma_R] < sqrt(E[sigma_R^2]) = sqrt(K_var) (Jensen); the gap, the convexity
adjustment, grows with the volatility of volatility. It has no static hedge, so we simulate.
Reference: Demeterfi et al. (1999), "More than you ever wanted to know about volatility
swaps"; Gatheral, *The Volatility Surface*, ch. 11; Carr & Lee (2009).
"""

import math
from dataclasses import dataclass

import numpy as np
from numpy.typing import NDArray

from derivlab.core.errors import UnsupportedError
from derivlab.engines.fourier.cos import cos_prices
from derivlab.engines.montecarlo.paths import simulate_paths
from derivlab.market import Market
from derivlab.models import BlackScholes, Heston, Merton, Model

from ._common import batch_sizes, pair_order

DAYS_PER_YEAR = 252


def expected_variance(model: Model, t: float) -> float:
    """E[annualised quadratic variation] over [0, t] (continuous monitoring)."""
    if isinstance(model, BlackScholes):
        return model.volatility**2
    if isinstance(model, Heston):
        k = model.kappa
        return model.theta + (model.v0 - model.theta) * (1 - math.exp(-k * t)) / (k * t)
    if isinstance(model, Merton):
        jumps = model.jump_mean**2 + model.jump_volatility**2
        return model.volatility**2 + model.intensity * jumps
    raise UnsupportedError(f"No expected-variance formula for {type(model).__name__}")


@dataclass(frozen=True)
class VarianceReplication:
    #: Fair variance strike from the discrete strip (annualised).
    strike: float
    forward: float
    strikes: NDArray[np.float64]
    #: Number of options held per strike, per unit variance notional: (2 e^{rT}/T) dK / K^2.
    weights: NDArray[np.float64]
    #: Out-of-the-money option prices (puts below the forward, calls above).
    option_prices: NDArray[np.float64]
    contributions: NDArray[np.float64]


def replicate_variance(
    market: Market, model: Model, t: float, n_strikes: int = 101, width: float = 8.0
) -> VarianceReplication:
    """Price the 1/K^2 option strip on a log-uniform strike grid spanning +/- `width`
    at-the-money standard deviations around the forward (trapezoid rule). Skewed models need
    a wide range: the left tail carries a lot of variance."""
    if n_strikes < 3:
        raise ValueError("need at least 3 strikes")
    if not isinstance(model, BlackScholes | Heston | Merton):
        raise UnsupportedError(f"No Fourier pricer for {type(model).__name__}")
    forward = market.forward(t)
    atm_sd = math.sqrt(expected_variance(model, t) * t)
    log_k = np.linspace(-width * atm_sd, width * atm_sd, n_strikes)
    strikes = forward * np.exp(log_k)
    puts = cos_prices("put", strikes, t, market, model)
    calls = cos_prices("call", strikes, t, market, model)
    # Far out-of-the-money calls come from put-call parity: clip the rounding noise.
    otm = np.maximum(np.where(strikes < forward, puts, calls), 0.0)
    # Trapezoid rule on a non-uniform grid: each strike covers half the gap to each neighbour.
    dk = np.empty(n_strikes)
    dk[1:-1] = 0.5 * (strikes[2:] - strikes[:-2])
    dk[0] = 0.5 * (strikes[1] - strikes[0])
    dk[-1] = 0.5 * (strikes[-1] - strikes[-2])
    weights = 2 * math.exp(market.rate * t) / t * dk / strikes**2
    contributions = weights * otm
    return VarianceReplication(
        float(contributions.sum()), forward, strikes, weights, otm, contributions
    )


@dataclass(frozen=True)
class RealisedVariance:
    #: Annualised realised variance per path (daily log returns).
    variances: NDArray[np.float64]
    fair_variance: float
    fair_variance_stderr: float
    fair_volatility: float
    fair_volatility_stderr: float

    @property
    def convexity_adjustment(self) -> float:
        """sqrt(K_var) - K_vol: what a volatility swap is worth less than sqrt of variance."""
        return math.sqrt(self.fair_variance) - self.fair_volatility


def simulate_realised_variance(
    market: Market, model: Model, t: float, paths: int = 20_000, seed: int = 42
) -> RealisedVariance:
    """Daily-sampled realised variance (sum of squared log returns / T), by simulation."""
    steps = max(1, round(t * DAYS_PER_YEAR))
    rng = np.random.default_rng(seed)
    parts = []
    for size in batch_sizes(paths):
        s = simulate_paths(market, model, t, steps, size, rng)
        parts.append((np.diff(np.log(s), axis=1) ** 2).sum(axis=1) / t)
    variances = pair_order(parts)
    vols = np.sqrt(variances)
    n = len(variances)
    return RealisedVariance(
        variances,
        float(variances.mean()),
        float(variances.std(ddof=1) / math.sqrt(n)),
        float(vols.mean()),
        float(vols.std(ddof=1) / math.sqrt(n)),
    )
