"""Monte Carlo for exotic options, under any model with a path generator.

Paths are simulated in batches (so daily monitoring over years never exhausts memory) on a
grid that contains every observation date. Continuous monitoring needs care: a path observed
daily can cross a barrier between two observations, or peak between them. For Black–Scholes
the Brownian bridge (the path between two grid points, given both ends) is known exactly:
- Barriers: the probability the bridge crossed is exp(-2 ln(S_i/H) ln(S_{i+1}/H) / (sigma^2 dt)).
  Multiplying survival probabilities over steps gives the exact continuous-monitoring payoff in
  expectation, with lower variance than discrete checking.
- Lookbacks: the bridge's maximum (or minimum) can be sampled exactly from one uniform per step.
For local volatility the same formulas use sigma(S_i, t_i) per step (very accurate), and for
Heston and Merton an effective constant volatility (an approximation, flagged in diagnostics).

Variance reduction:
- Arithmetic fixed-strike Asians under Black–Scholes: the geometric Asian, which has a closed
  form and is ~99% correlated, as a control variate (Kemna & Vorst 1990).
- Everything else: the discounted terminal spot, whose expectation is known.
Reference: Glasserman, Monte Carlo Methods in Financial Engineering, ch. 4 and 6.
"""

import math
from dataclasses import dataclass

import numpy as np
from numpy.typing import NDArray

from derivlab.core.errors import UnsupportedError
from derivlab.instruments import AsianOption, BarrierOption, DigitalOption, Exotic, LookbackOption
from derivlab.market import Market
from derivlab.models import BlackScholes, Heston, LocalVol, Merton, Model
from derivlab.results import PricingResult

from .paths import DISCRETISED_MODELS, MAX_PATH_NODES, simulate_paths

#: Grid steps per year used to approximate continuous monitoring (before bridge corrections).
MONITORING_STEPS_PER_YEAR = 252


@dataclass(frozen=True)
class ExoticSettings:
    paths: int
    seed: int
    antithetic: bool
    control_variate: bool
    steps_per_year: int


def effective_volatility(model: Model, market: Market, t: float) -> float | None:
    """A constant volatility for bridge corrections; None when the model gives sigma per point."""
    if isinstance(model, BlackScholes):
        return model.volatility
    if isinstance(model, LocalVol):
        return None
    if isinstance(model, Heston):
        # Expected average variance over [0, T].
        decay = (1 - math.exp(-model.kappa * t)) / (model.kappa * t)
        return math.sqrt(model.theta + (model.v0 - model.theta) * decay)
    if isinstance(model, Merton):
        return math.sqrt(
            model.volatility**2 + model.intensity * (model.jump_mean**2 + model.jump_volatility**2)
        )
    raise UnsupportedError(f"No path generator for {type(model).__name__}")


def _grid_steps(option: Exotic, model: Model, settings: ExoticSettings) -> tuple[int, bool]:
    """Number of grid steps, and whether continuous monitoring needs a bridge correction."""
    t = option.expiry
    observations: int | None
    if isinstance(option, AsianOption):
        observations = option.fixings
    elif isinstance(option, BarrierOption | LookbackOption):
        observations = option.observations
    else:
        observations = 1  # digitals only need the terminal value
    continuous = observations is None
    steps = (
        max(1, math.ceil(MONITORING_STEPS_PER_YEAR * t)) if observations is None else observations
    )
    if isinstance(model, DISCRETISED_MODELS):
        minimum = math.ceil(settings.steps_per_year * t)
        if not continuous:
            steps *= max(1, math.ceil(minimum / steps))  # keep every observation date on the grid
        else:
            steps = max(steps, minimum)
    return steps, continuous


def _sigma_per_step(
    model: Model, sigma: float | None, paths: NDArray[np.float64], times: NDArray[np.float64]
) -> NDArray[np.float64] | float:
    if sigma is not None:
        return sigma
    assert isinstance(model, LocalVol)
    return np.stack(
        [model(paths[:, i], float(times[i])) for i in range(paths.shape[1] - 1)], axis=1
    )


def _barrier_payoff(
    option: BarrierOption,
    paths: NDArray[np.float64],
    times: NDArray[np.float64],
    continuous: bool,
    model: Model,
    sigma: float | None,
) -> NDArray[np.float64]:
    hit = option.hit_on_grid(paths)
    vanilla = option.vanilla(paths[:, -1])
    if not continuous:
        return option.payoff_given_hit(paths[:, -1], hit)
    # Brownian bridge: probability of crossing between consecutive grid points.
    dt = np.diff(times)
    sig = _sigma_per_step(model, sigma, paths, times)
    log_ratio = np.log(paths / option.barrier)
    exponent = -2 * log_ratio[:, :-1] * log_ratio[:, 1:] / (np.square(sig) * dt)
    cross = np.where(hit[:, None], 1.0, np.exp(np.minimum(exponent, 0.0)))
    survival = np.where(hit, 0.0, np.prod(1 - cross, axis=1))
    knocked_out = vanilla * survival
    return knocked_out if option.knock == "out" else vanilla - knocked_out


def _lookback_payoff(
    option: LookbackOption,
    paths: NDArray[np.float64],
    times: NDArray[np.float64],
    continuous: bool,
    model: Model,
    sigma: float | None,
    rng: np.random.Generator,
) -> NDArray[np.float64]:
    if not continuous:
        return option.payoff_paths(paths, times)
    # Exact bridge extremes in log space: max = (a + b + sqrt((b - a)^2 - 2 s^2 dt ln U)) / 2.
    dt = np.diff(times)
    sig = _sigma_per_step(model, sigma, paths, times)
    x = np.log(paths)
    a, b = x[:, :-1], x[:, 1:]
    spread = np.sqrt((b - a) ** 2 - 2 * np.square(sig) * dt * np.log(rng.random(a.shape)))
    use_max = (option.strike_type == "floating") == (option.kind == "put")
    if use_max:
        high = np.exp(((a + b + spread) / 2).max(axis=1))
        low = paths.min(axis=1)
    else:
        low = np.exp(((a + b - spread) / 2).min(axis=1))
        high = paths.max(axis=1)
    return option.payoff_from_extremes(paths[:, -1], low, high)


def price_exotic(
    option: Exotic, market: Market, model: Model, settings: ExoticSettings
) -> PricingResult:
    from derivlab.engines.analytic.exotics import geometric_asian_price  # avoid import cycle

    t = option.expiry
    steps, continuous = _grid_steps(option, model, settings)
    sigma = effective_volatility(model, market, t)
    times = np.linspace(0.0, t, steps + 1)
    discount = market.discount(t)
    rng = np.random.default_rng(settings.seed)

    use_geometric_cv = (
        settings.control_variate
        and isinstance(option, AsianOption)
        and isinstance(model, BlackScholes)
        and option.strike_type == "fixed"
        and option.averaging == "arithmetic"
    )
    geometric = None
    geometric_mean = 0.0
    if use_geometric_cv:
        assert isinstance(option, AsianOption) and isinstance(model, BlackScholes)
        geometric = AsianOption(option.kind, option.strike, t, option.fixings, "geometric")
        geometric_mean = geometric_asian_price(geometric, market, model.volatility)
    control_mean = market.spot * math.exp(-market.dividend_yield * t)

    batch = max(2, (MAX_PATH_NODES // 4) // (steps + 1))
    batch -= batch % 2
    remaining = settings.paths + settings.paths % 2
    samples_parts, controls_parts = [], []
    while remaining > 0:
        n = min(batch, remaining)
        remaining -= n
        paths = simulate_paths(market, model, t, steps, n, rng, settings.antithetic)
        if isinstance(option, BarrierOption):
            payoff = _barrier_payoff(option, paths, times, continuous, model, sigma)
        elif isinstance(option, LookbackOption):
            payoff = _lookback_payoff(option, paths, times, continuous, model, sigma, rng)
        elif isinstance(option, AsianOption | DigitalOption):
            payoff = option.payoff_paths(paths, times)
        else:
            raise UnsupportedError(f"Monte Carlo does not price {type(option).__name__}")
        samples_parts.append(discount * payoff)
        if geometric is not None:
            controls_parts.append(discount * geometric.payoff_paths(paths, times))
        else:
            controls_parts.append(discount * paths[:, -1])

    samples = np.concatenate(samples_parts)
    controls = np.concatenate(controls_parts)
    if settings.control_variate:
        expected = geometric_mean if geometric is not None else control_mean
        variance = np.var(controls, ddof=1)
        if variance > 0:
            beta = np.cov(samples, controls, ddof=1)[0, 1] / variance
            samples = samples - beta * (controls - expected)

    if settings.antithetic:
        # Antithetic partners sit in the two halves of each batch.
        pairs = []
        start = 0
        for part in samples_parts:
            half = len(part) // 2
            chunk = samples[start : start + len(part)]
            pairs.append(0.5 * (chunk[:half] + chunk[half:]))
            start += len(part)
        independent = np.concatenate(pairs)
    else:
        independent = samples
    stderr = float(np.std(independent, ddof=1) / math.sqrt(len(independent)))

    diagnostics: dict[str, float | int | str] = {"paths": len(samples), "steps": steps}
    if continuous and isinstance(option, BarrierOption | LookbackOption):
        diagnostics["monitoring"] = (
            "continuous (Brownian bridge)"
            if isinstance(model, BlackScholes | LocalVol)
            else "continuous (bridge with effective volatility: approximate)"
        )
    if geometric is not None:
        diagnostics["control_variate"] = "geometric Asian"
    return PricingResult(float(np.mean(samples)), stderr=stderr, diagnostics=diagnostics)
