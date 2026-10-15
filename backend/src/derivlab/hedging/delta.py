"""Discrete delta hedging of a European option position.

The trader holds `position` options (negative = sold) and trades the underlying to keep the
combined delta at zero, re-balancing `rebalances` times over the option's life. Cash earns the
risk-free rate, shares earn the dividend yield, and each trade pays a proportional cost.

What the experiment shows:
- Continuous hedging would replicate the option exactly (that is the Black–Scholes argument).
  With N discrete re-balances the hedging error has standard deviation of roughly
  sqrt(pi/4) * vega * sigma / sqrt(N) (Derman & Kamal), so halving the error takes 4x the trades.
- If the hedger's volatility differs from the volatility the market actually realises, the
  P&L drifts: a seller who assumed too low a volatility loses on average, even with perfect
  hedging, because the premium collected was too small.
- Trading costs grow with the number of re-balances, so there is an optimal frequency.

The spot follows GBM with drift r - q. The drift barely affects hedged P&L (it is hedged away);
it matters for the unhedged position, which is shown for contrast.
Reference: Hull ch. 19; Derman & Kamal (1999), "When You Cannot Hedge Continuously".
"""

import math
from collections.abc import Iterable
from dataclasses import dataclass

import numpy as np
from numpy.typing import NDArray

from derivlab.engines.analytic import black_scholes_arrays
from derivlab.engines.montecarlo import gbm_paths
from derivlab.instruments import VanillaOption
from derivlab.market import Market
from derivlab.models import BlackScholes


@dataclass(frozen=True)
class HedgeResult:
    #: Terminal P&L of the hedged position, one per path.
    hedged_pnl: NDArray[np.float64]
    #: Terminal P&L of the same position left unhedged (premium invested at r).
    unhedged_pnl: NDArray[np.float64]
    #: Total trading costs paid, one per path.
    costs: NDArray[np.float64]
    #: Re-balancing dates (years), including 0 and expiry.
    times: NDArray[np.float64]
    #: A few sample paths: spot and mark-to-market hedged P&L at each date.
    sample_spots: NDArray[np.float64]
    sample_pnl: NDArray[np.float64]
    #: Premium per option at the hedger's volatility.
    premium: float
    #: Derman–Kamal approximation of the hedged P&L standard deviation (no costs).
    approx_std: float


def simulate_delta_hedge(
    option: VanillaOption,
    market: Market,
    realised: BlackScholes,
    hedge_volatility: float | None = None,
    position: float = -1.0,
    rebalances: int = 52,
    paths: int = 2000,
    cost_bps: float = 0.0,
    seed: int = 42,
    samples: int = 3,
) -> HedgeResult:
    """Simulate `paths` hedged trajectories under the `realised` volatility.

    The hedger prices and computes deltas with `hedge_volatility` (default: the realised one).
    """
    if option.is_american:
        raise ValueError("delta hedging simulation supports European options only")
    if option.expiry <= 0 or realised.volatility <= 0:
        raise ValueError("need positive expiry and realised volatility")
    if rebalances < 1 or paths < 2 or cost_bps < 0:
        raise ValueError("need rebalances >= 1, paths >= 2 and non-negative costs")
    sigma_h = realised.volatility if hedge_volatility is None else hedge_volatility
    if sigma_h <= 0:
        raise ValueError("hedge volatility must be positive")

    t, strike, sign = option.expiry, option.payoff.strike, option.payoff.sign
    r, q = market.rate, market.dividend_yield
    dt = t / rebalances
    times = np.linspace(0.0, t, rebalances + 1)
    paths += paths % 2
    spots = gbm_paths(market, realised, t, rebalances, paths, np.random.default_rng(seed))
    cost_rate = cost_bps / 10_000

    def value_delta(s: NDArray[np.float64], tau: float):
        return black_scholes_arrays(s, strike, tau, r, q, sigma_h, sign)

    option_value, option_delta = value_delta(spots[:, 0], t)
    premium = float(option_value[0])
    shares = -position * option_delta  # offsets the option position's delta
    cash = -position * option_value - shares * spots[:, 0]
    costs = np.abs(shares) * spots[:, 0] * cost_rate
    cash -= costs

    n_samples = min(samples, paths)
    sample_pnl = np.zeros((n_samples, rebalances + 1))
    growth, carry = math.exp(r * dt), math.expm1(q * dt)
    for i in range(1, rebalances + 1):
        s = spots[:, i]
        cash = cash * growth + shares * s * carry  # interest on cash, dividends on shares
        tau = t - times[i]
        option_value, option_delta = value_delta(s, tau)
        if i < rebalances:
            new_shares = -position * option_delta
            fee = np.abs(new_shares - shares) * s * cost_rate
            cash -= (new_shares - shares) * s + fee
            costs += fee
            shares = new_shares
        mark = cash + shares * s + position * option_value
        sample_pnl[:, i] = mark[:n_samples]

    terminal = spots[:, -1]
    payoff = option.payoff(terminal)
    hedged = cash + shares * terminal + position * payoff
    unhedged = -position * premium * math.exp(r * t) + position * payoff

    # Derman–Kamal, evaluated with today's vega of the whole position.
    width = sigma_h * math.sqrt(t)
    d1 = (math.log(market.spot / strike) + (r - q + 0.5 * sigma_h**2) * t) / width
    vega = abs(position) * market.spot * math.exp(-q * t) * math.sqrt(t)
    vega *= math.exp(-0.5 * d1 * d1) / math.sqrt(2 * math.pi)
    approx_std = math.sqrt(math.pi / 4) * vega * realised.volatility / math.sqrt(rebalances)

    return HedgeResult(
        hedged_pnl=hedged,
        unhedged_pnl=unhedged,
        costs=costs,
        times=times,
        sample_spots=spots[:n_samples],
        sample_pnl=sample_pnl,
        premium=premium,
        approx_std=approx_std,
    )


@dataclass(frozen=True)
class FrequencyPoint:
    rebalances: int
    mean: float
    std: float
    approx_std: float
    mean_cost: float


def hedge_frequency_study(
    option: VanillaOption,
    market: Market,
    realised: BlackScholes,
    hedge_volatility: float | None = None,
    position: float = -1.0,
    cost_bps: float = 0.0,
    rebalances: Iterable[int] = (4, 12, 26, 52, 104, 252),
    paths: int = 2000,
    seed: int = 42,
) -> list[FrequencyPoint]:
    """Hedged P&L mean and spread as re-balancing gets more frequent."""
    points = []
    for n in rebalances:
        result = simulate_delta_hedge(
            option, market, realised, hedge_volatility, position, n, paths, cost_bps, seed, 0
        )
        points.append(
            FrequencyPoint(
                n,
                float(result.hedged_pnl.mean()),
                float(result.hedged_pnl.std(ddof=1)),
                result.approx_std,
                float(result.costs.mean()),
            )
        )
    return points
