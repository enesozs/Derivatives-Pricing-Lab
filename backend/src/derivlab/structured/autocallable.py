"""Autocallable notes: the best-selling structured product in Europe and Asia.

The investor lends 1 (the notional) and, on each observation date t_j, looks at the
performance W_j = S(t_j)/S(0) (for a worst-of note, the worst of several assets):
- Coupon: if W_j >= coupon barrier, a coupon c/frequency is paid. With **memory**, coupons
  missed on earlier dates are paid too.
- Autocall: if W_j >= autocall level (after any non-call period), the note redeems at par
  and stops.
- At maturity, if never called: par back, unless the **protection barrier** was breached
  (at maturity only, or on any daily close), in which case the investor receives W_T and
  takes the full loss below the initial level.
Economically the investor sells a down-and-in put (and digital-like coupon options) to the
issuer and is paid through the coupon. The product is short volatility and, for worst-ofs,
short correlation-diversification: lower correlation makes the worst asset worse.

Pricing is by Monte Carlo on full paths. The value is linear in the coupon rate, so the
**fair coupon** (value = par) comes from the same paths: V = A + c B  =>  c* = (1 - A) / B.
Reference: Bouzoubaa & Osseiran, *Exotic Options and Hybrids*, ch. 10; Deng et al. (2011).
"""

import math
from collections.abc import Callable
from dataclasses import dataclass
from typing import Literal

import numpy as np
from numpy.typing import NDArray

from derivlab.engines.montecarlo.paths import DISCRETISED_MODELS, simulate_paths
from derivlab.market import Market
from derivlab.models import Model
from derivlab.multi_asset.market import CorrelatedBlackScholes, MultiAssetMarket
from derivlab.multi_asset.montecarlo import correlated_paths

from ._common import batch_sizes, mean_and_stderr, pair_order

DAYS_PER_YEAR = 252


@dataclass(frozen=True)
class Autocallable:
    maturity: float = 3.0
    #: Observation (and coupon) dates per year.
    frequency: int = 4
    #: Annual coupon rate, paid as coupon / frequency per observation.
    coupon: float = 0.08
    autocall_level: float = 1.0
    coupon_barrier: float = 0.7
    protection_barrier: float = 0.6
    memory: bool = True
    #: "maturity": protection checked on the final fixing only; "daily": on every close.
    monitoring: Literal["maturity", "daily"] = "maturity"
    #: Observations before the first possible autocall.
    non_call_periods: int = 0

    def __post_init__(self) -> None:
        if not 0 < self.maturity <= 10 or not 1 <= self.frequency <= 12:
            raise ValueError("need 0 < maturity <= 10 and 1 <= frequency <= 12")
        n = self.maturity * self.frequency
        if abs(n - round(n)) > 1e-9:
            raise ValueError("maturity must be a whole number of observation periods")
        if min(self.autocall_level, self.coupon_barrier, self.protection_barrier) <= 0:
            raise ValueError("levels must be positive (fractions of the initial level)")
        if self.coupon < 0:
            raise ValueError("coupon must be non-negative")
        if self.monitoring not in ("maturity", "daily"):
            raise ValueError("monitoring must be 'maturity' or 'daily'")
        if not 0 <= self.non_call_periods < self.observations:
            raise ValueError("non-call periods must leave at least one autocall date")

    @property
    def observations(self) -> int:
        return round(self.maturity * self.frequency)

    @property
    def observation_times(self) -> NDArray[np.float64]:
        return np.arange(1, self.observations + 1) / self.frequency


@dataclass(frozen=True)
class AutocallableResult:
    value: float
    stderr: float
    #: Coupon rate that prices the note at par (1.0).
    fair_coupon: float
    #: Probability of redeeming on each observation date (the last one includes maturity).
    redemption_probabilities: tuple[float, ...]
    #: Probability of losing capital at maturity.
    loss_probability: float
    expected_life: float
    #: Value of the principal leg alone (A) and per unit of coupon rate (B): V = A + c B.
    principal_value: float
    coupon_annuity: float
    #: Per path: everything received (undiscounted coupons + redemption) minus 1.
    total_returns: NDArray[np.float64]


def _evaluate(
    note: Autocallable, worst: NDArray[np.float64], obs_index: NDArray[np.int64], rate: float
) -> dict[str, NDArray[np.float64]]:
    """Cash flows per path from worst-of performance paths (normalised to 1 at t=0)."""
    n_paths = worst.shape[0]
    times = note.observation_times
    alive = np.ones(n_paths, dtype=bool)
    unpaid = np.zeros(n_paths)
    principal = np.zeros(n_paths)  # discounted redemption
    coupon_units = np.zeros(n_paths)  # discounted coupon periods (x 1/frequency)
    received = np.zeros(n_paths)  # undiscounted coupon periods
    redeemed_at = np.full(n_paths, len(times) - 1)
    redemption = np.ones(n_paths)
    last = len(times) - 1
    for j, (t, idx) in enumerate(zip(times, obs_index, strict=True)):
        w = worst[:, idx]
        df = math.exp(-rate * t)
        pay = alive & (w >= note.coupon_barrier)
        periods = 1 + unpaid if note.memory else np.ones(n_paths)
        coupon_units += np.where(pay, periods * df / note.frequency, 0.0)
        received += np.where(pay, periods / note.frequency, 0.0)
        unpaid = np.where(pay, 0.0, np.where(alive, unpaid + 1, unpaid))
        if j < last and j >= note.non_call_periods:
            called = alive & (w >= note.autocall_level)
            principal += np.where(called, df, 0.0)
            redeemed_at[called] = j
            alive &= ~called
    w_final = worst[:, obs_index[-1]]
    breached = (
        worst.min(axis=1) < note.protection_barrier
        if note.monitoring == "daily"
        else w_final < note.protection_barrier
    )
    loss = alive & breached & (w_final < 1.0)
    redemption = np.where(loss, w_final, 1.0)
    principal += np.where(alive, redemption * math.exp(-rate * times[-1]), 0.0)
    return {
        "principal": principal,
        "coupon_units": coupon_units,
        "received": received,
        "redeemed_at": redeemed_at.astype(float),
        "loss": loss.astype(float),
        "total": received * note.coupon + redemption - 1.0,
    }


Generator = Callable[[int, int, np.random.Generator], NDArray[np.float64]]


def _simulate(
    note: Autocallable, generate: Generator, rate: float, steps: int, paths: int, seed: int
) -> AutocallableResult:
    rng = np.random.default_rng(seed)
    per_step = steps // note.observations
    obs_index = np.arange(1, note.observations + 1) * per_step
    parts: dict[str, list[NDArray[np.float64]]] = {}
    for size in batch_sizes(paths):
        out = _evaluate(note, generate(steps, size, rng), obs_index, rate)
        for key, values in out.items():
            parts.setdefault(key, []).append(values)
    cols = {key: pair_order(values) for key, values in parts.items()}
    principal, units = cols["principal"], cols["coupon_units"]
    value, stderr = mean_and_stderr(principal + note.coupon * units)
    a, b = float(principal.mean()), float(units.mean())
    at = cols["redeemed_at"].astype(int)
    probs = np.bincount(at, minlength=note.observations) / len(at)
    return AutocallableResult(
        value=value,
        stderr=stderr,
        fair_coupon=(1.0 - a) / b if b > 0 else math.inf,
        redemption_probabilities=tuple(float(p) for p in probs),
        loss_probability=float(cols["loss"].mean()),
        expected_life=float((probs * note.observation_times).sum()),
        principal_value=a,
        coupon_annuity=b,
        total_returns=cols["total"],
    )


def _steps(note: Autocallable, exact: bool) -> int:
    """Observation dates only when the transition is exact and the barrier is checked at
    maturity; otherwise a daily grid."""
    if exact and note.monitoring == "maturity":
        return note.observations
    return note.observations * math.ceil(DAYS_PER_YEAR / note.frequency)


def price_autocallable(
    note: Autocallable,
    market: Market,
    model: Model,
    paths: int = 20_000,
    seed: int = 42,
    reference: float | None = None,
) -> AutocallableResult:
    """Single-underlying note under any model with a path generator. `reference` is the
    initial fixing the levels refer to (default: today's spot, i.e. a new note)."""
    fixing = market.spot if reference is None else reference

    def generate(steps: int, n: int, rng: np.random.Generator) -> NDArray[np.float64]:
        return simulate_paths(market, model, note.maturity, steps, n, rng) / fixing

    steps = _steps(note, exact=not isinstance(model, DISCRETISED_MODELS))
    return _simulate(note, generate, market.rate, steps, paths, seed)


def price_worst_of_autocallable(
    note: Autocallable,
    market: MultiAssetMarket,
    model: CorrelatedBlackScholes,
    paths: int = 20_000,
    seed: int = 42,
    references: tuple[float, ...] | None = None,
) -> AutocallableResult:
    """Worst-of note on several correlated Black–Scholes assets."""
    spots = np.array(market.spots if references is None else references)

    def generate(steps: int, n: int, rng: np.random.Generator) -> NDArray[np.float64]:
        return (correlated_paths(market, model, note.maturity, steps, n, rng) / spots).min(axis=2)

    return _simulate(note, generate, market.rate, _steps(note, exact=True), paths, seed)
