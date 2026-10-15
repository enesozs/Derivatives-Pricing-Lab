"""Path generators. Every Monte Carlo engine prices off full paths, so path-dependent
products (Phase 3) only need a new payoff, not a new engine."""

import math

import numpy as np
from numpy.typing import NDArray

from derivlab.market import Market
from derivlab.models import BlackScholes

MAX_PATH_NODES = 20_000_000  # paths * (steps + 1); ~160 MB of float64


def gbm_paths(
    market: Market,
    model: BlackScholes,
    expiry: float,
    steps: int,
    n_paths: int,
    rng: np.random.Generator,
    antithetic: bool = True,
) -> NDArray[np.float64]:
    """Simulate GBM spot paths on a uniform grid; returns shape (n_paths, steps + 1).

    Uses the exact log-normal transition, so there is no time-discretisation bias at the
    grid dates. With `antithetic`, rows i and i + n_paths/2 use opposite normal draws.
    """
    if steps < 1 or n_paths < 2:
        raise ValueError("need at least 1 step and 2 paths")
    if antithetic and n_paths % 2:
        raise ValueError("antithetic sampling needs an even number of paths")
    if n_paths * (steps + 1) > MAX_PATH_NODES:
        raise ValueError(f"paths * (steps + 1) must not exceed {MAX_PATH_NODES:,}")

    dt = expiry / steps
    if antithetic:
        half = rng.standard_normal((n_paths // 2, steps))
        z = np.concatenate([half, -half])
    else:
        z = rng.standard_normal((n_paths, steps))

    sigma = model.volatility
    drift = (market.rate - market.dividend_yield - 0.5 * sigma**2) * dt
    log_increments = drift + sigma * math.sqrt(dt) * z
    log_paths = np.concatenate([np.zeros((n_paths, 1)), np.cumsum(log_increments, axis=1)], axis=1)
    return market.spot * np.exp(log_paths)
