"""Forward-start options and cliquets: options whose strike is set in the future.

**Forward-start option** (Rubinstein 1991): at t1 the strike is fixed at m S(t1); the option
then runs to T. Under Black–Scholes the value scales with the spot at t1, so
  value = S_0 e^{-q t1} * BS(spot 1, strike m, T - t1).
It depends only on the volatility *between* t1 and T: a pure bet on forward volatility,
which is why forward-starts and cliquets are priced very differently by Black–Scholes and
stochastic-volatility models even when both fit today's vanilla prices.

**Cliquet** (ratchet): a strip of forward-starting returns R_i = S(t_i)/S(t_{i-1}) - 1, each
clipped to [local floor, local cap], summed, then clipped to [global floor, global cap]:
  payoff = max(global floor, min(global cap, sum_i min(cap, max(floor, R_i)))).
Each clipped return is a forward-start call spread, so without a binding global floor or cap
the Black–Scholes value is a closed form; with one, we simulate. Popular in capital-protected
notes: the global floor is the protection, the local cap pays for it.
Reference: Gatheral ch. 10 (cliquets and forward skew); Wilmott, *Paul Wilmott on QF* ch. 25.
"""

import math
from dataclasses import dataclass
from typing import Literal

import numpy as np
from numpy.typing import NDArray

from derivlab.engines.analytic.black_scholes import black_scholes
from derivlab.engines.montecarlo.paths import DISCRETISED_MODELS, simulate_paths
from derivlab.market import Market
from derivlab.models import BlackScholes, Model

from ._common import batch_sizes, mean_and_stderr, pair_order

STEPS_PER_YEAR = 100  # for models without an exact transition


@dataclass(frozen=True)
class ForwardStartOption:
    start: float
    expiry: float
    #: Strike as a fraction of the spot on the start date.
    moneyness: float = 1.0
    kind: Literal["call", "put"] = "call"

    def __post_init__(self) -> None:
        if not 0 <= self.start < self.expiry:
            raise ValueError("need 0 <= start < expiry")
        if self.moneyness <= 0:
            raise ValueError("moneyness must be positive")


def forward_start_black_scholes(
    option: ForwardStartOption, market: Market, model: BlackScholes
) -> float:
    sign = 1 if option.kind == "call" else -1
    unit, _ = black_scholes(
        1.0,
        option.moneyness,
        option.expiry - option.start,
        market.rate,
        market.dividend_yield,
        model.volatility,
        sign,
    )
    return market.spot * math.exp(-market.dividend_yield * option.start) * unit


def _grid(model: Model, horizon: float, dates: int) -> int:
    """Steps per period: one if the transition is exact, else enough for ~100 a year."""
    if not isinstance(model, DISCRETISED_MODELS):
        return 1
    return max(1, math.ceil(STEPS_PER_YEAR * horizon / dates))


def forward_start_monte_carlo(
    option: ForwardStartOption, market: Market, model: Model, paths: int = 50_000, seed: int = 42
) -> tuple[float, float]:
    """Simulated on one uniform grid of ~100 steps a year, so the variance state at the start
    date carries over (it matters under stochastic volatility)."""
    steps = max(2, round(option.expiry * STEPS_PER_YEAR))
    i_start = round(option.start / option.expiry * steps)
    if abs(i_start * option.expiry / steps - option.start) > 1e-9:
        raise ValueError(f"start date must lie on the 1/{STEPS_PER_YEAR}-year simulation grid")
    rng = np.random.default_rng(seed)
    sign = 1 if option.kind == "call" else -1
    parts = []
    for size in batch_sizes(paths):
        s = simulate_paths(market, model, option.expiry, steps, size, rng)
        payoff = np.maximum(sign * (s[:, -1] - option.moneyness * s[:, i_start]), 0.0)
        parts.append(math.exp(-market.rate * option.expiry) * payoff)
    return mean_and_stderr(pair_order(parts))


@dataclass(frozen=True)
class Cliquet:
    maturity: float = 3.0
    #: Number of reset periods (e.g. 12 quarterly periods over 3 years).
    periods: int = 12
    #: Per-period return bounds (None = unbounded).
    local_floor: float | None = 0.0
    local_cap: float | None = 0.02
    #: Bounds on the summed return (None = unbounded).
    global_floor: float | None = 0.0
    global_cap: float | None = None

    def __post_init__(self) -> None:
        if not 0 < self.maturity <= 10 or not 1 <= self.periods <= 120:
            raise ValueError("need 0 < maturity <= 10 and 1 <= periods <= 120")
        lf, lc = self.local_floor, self.local_cap
        if lf is not None and lc is not None and lf >= lc:
            raise ValueError("local floor must be below the local cap")
        gf, gc = self.global_floor, self.global_cap
        if gf is not None and gc is not None and gf >= gc:
            raise ValueError("global floor must be below the global cap")

    def payoff(self, returns: NDArray[np.float64]) -> NDArray[np.float64]:
        """Per unit notional, from per-period returns of shape (paths, periods)."""
        lo = -np.inf if self.local_floor is None else self.local_floor
        hi = np.inf if self.local_cap is None else self.local_cap
        total = np.clip(returns, lo, hi).sum(axis=1)
        glo = -np.inf if self.global_floor is None else self.global_floor
        ghi = np.inf if self.global_cap is None else self.global_cap
        return np.clip(total, glo, ghi)

    @property
    def global_bounds_bind(self) -> bool:
        """Whether a global bound can ever be reached (then no closed form)."""
        n = self.periods
        if self.global_floor is not None and (
            self.local_floor is None or self.global_floor > n * self.local_floor
        ):
            return True
        return self.global_cap is not None and (
            self.local_cap is None or self.global_cap < n * self.local_cap
        )


def cliquet_black_scholes(cliquet: Cliquet, market: Market, model: BlackScholes) -> float | None:
    """Closed form when no global bound can bind: a sum of forward-start call spreads."""
    if cliquet.global_bounds_bind:
        return None
    dt = cliquet.maturity / cliquet.periods
    r, q, vol = market.rate, market.dividend_yield, model.volatility
    growth = math.exp((r - q) * dt)

    def call(strike: float) -> float:
        """E[(X - K)^+] for X = S(t_i)/S(t_{i-1}), undiscounted."""
        if strike <= 0:
            return growth - strike
        value, _ = black_scholes(1.0, strike, dt, r, q, vol, 1)
        return value * math.exp(r * dt)

    lf, lc = cliquet.local_floor, cliquet.local_cap
    # min(cap, max(floor, R)) = floor + (X - (1 + floor))^+ - (X - (1 + cap))^+
    base = growth - 1 if lf is None else lf + call(1 + lf)
    capped = 0.0 if lc is None else call(1 + lc)
    return math.exp(-r * cliquet.maturity) * cliquet.periods * (base - capped)


@dataclass(frozen=True)
class CliquetResult:
    value: float
    stderr: float
    #: Summed (globally clipped) return per path, undiscounted.
    payoffs: NDArray[np.float64]
    #: Per-period returns of the first few thousand paths, before clipping.
    period_returns: NDArray[np.float64]


def price_cliquet(
    cliquet: Cliquet, market: Market, model: Model, paths: int = 50_000, seed: int = 42
) -> CliquetResult:
    rng = np.random.default_rng(seed)
    sub = _grid(model, cliquet.maturity, cliquet.periods)
    steps = cliquet.periods * sub
    payoffs, returns = [], []
    for size in batch_sizes(paths):
        s = simulate_paths(market, model, cliquet.maturity, steps, size, rng)[:, ::sub]
        r = s[:, 1:] / s[:, :-1] - 1
        payoffs.append(cliquet.payoff(r))
        if not returns:
            returns.append(r)
    flat = pair_order(payoffs)
    value, stderr = mean_and_stderr(math.exp(-market.rate * cliquet.maturity) * flat)
    return CliquetResult(value, stderr, flat, returns[0])
