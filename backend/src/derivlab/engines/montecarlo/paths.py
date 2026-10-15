"""Path generators. Every Monte Carlo engine prices off full paths, so path-dependent
products (Phase 3) only need a new payoff, not a new engine.

All generators return spots with shape (n_paths, steps + 1) on a uniform time grid, and support
antithetic sampling (rows i and i + n/2 use mirrored normal draws).

Discretisation:
- Black–Scholes and Merton: exact transition, so no time-step bias at the grid dates.
- Heston: full-truncation Euler on log-spot (Lord, Koekkoek & van Dijk 2010). The variance is
  floored at zero inside the drift and diffusion; bias is O(dt), so use ~100+ steps per year.
- Local volatility: Euler on log-spot with sigma(S, t) frozen over each step; bias O(dt).
"""

import math

import numpy as np
from numpy.typing import NDArray

from derivlab.core.errors import UnsupportedError
from derivlab.market import Market
from derivlab.models import BlackScholes, Heston, LocalVol, Merton, Model

MAX_PATH_NODES = 20_000_000  # paths * (steps + 1); ~160 MB of float64


def _check(steps: int, n_paths: int, antithetic: bool) -> None:
    if steps < 1 or n_paths < 2:
        raise ValueError("need at least 1 step and 2 paths")
    if antithetic and n_paths % 2:
        raise ValueError("antithetic sampling needs an even number of paths")
    if n_paths * (steps + 1) > MAX_PATH_NODES:
        raise ValueError(f"paths * (steps + 1) must not exceed {MAX_PATH_NODES:,}")


def _normals(
    rng: np.random.Generator, n_paths: int, steps: int, antithetic: bool
) -> NDArray[np.float64]:
    if antithetic:
        half = rng.standard_normal((n_paths // 2, steps))
        return np.concatenate([half, -half])
    return rng.standard_normal((n_paths, steps))


def _from_log_increments(spot: float, increments: NDArray[np.float64]) -> NDArray[np.float64]:
    n_paths = increments.shape[0]
    log_paths = np.concatenate([np.zeros((n_paths, 1)), np.cumsum(increments, axis=1)], axis=1)
    return spot * np.exp(log_paths)


def gbm_paths(
    market: Market,
    model: BlackScholes,
    expiry: float,
    steps: int,
    n_paths: int,
    rng: np.random.Generator,
    antithetic: bool = True,
) -> NDArray[np.float64]:
    """Black–Scholes paths with the exact log-normal transition."""
    _check(steps, n_paths, antithetic)
    dt = expiry / steps
    sigma = model.volatility
    drift = (market.rate - market.dividend_yield - 0.5 * sigma**2) * dt
    z = _normals(rng, n_paths, steps, antithetic)
    return _from_log_increments(market.spot, drift + sigma * math.sqrt(dt) * z)


def merton_paths(
    market: Market,
    model: Merton,
    expiry: float,
    steps: int,
    n_paths: int,
    rng: np.random.Generator,
    antithetic: bool = True,
) -> NDArray[np.float64]:
    """Merton paths: exact diffusion plus a Poisson number of lognormal jumps per step."""
    _check(steps, n_paths, antithetic)
    dt = expiry / steps
    sigma, lam = model.volatility, model.intensity
    drift = (
        market.rate - market.dividend_yield - lam * model.jump_compensator - 0.5 * sigma**2
    ) * dt
    z = _normals(rng, n_paths, steps, antithetic)
    jumps = rng.poisson(lam * dt, size=(n_paths, steps))
    jump_noise = rng.standard_normal((n_paths, steps))
    jump_sizes = jumps * model.jump_mean + np.sqrt(jumps) * model.jump_volatility * jump_noise
    return _from_log_increments(market.spot, drift + sigma * math.sqrt(dt) * z + jump_sizes)


def heston_paths(
    market: Market,
    model: Heston,
    expiry: float,
    steps: int,
    n_paths: int,
    rng: np.random.Generator,
    antithetic: bool = True,
) -> NDArray[np.float64]:
    """Heston paths by full-truncation Euler on (log S, v)."""
    _check(steps, n_paths, antithetic)
    dt = expiry / steps
    sqrt_dt = math.sqrt(dt)
    z1 = _normals(rng, n_paths, steps, antithetic)
    z2 = _normals(rng, n_paths, steps, antithetic)
    rho, rho_bar = model.rho, math.sqrt(1 - model.rho**2)
    carry = market.rate - market.dividend_yield

    log_s = np.zeros((n_paths, steps + 1))
    v = np.full(n_paths, model.v0)
    for i in range(steps):
        v_pos = np.maximum(v, 0.0)
        root = np.sqrt(v_pos) * sqrt_dt
        log_s[:, i + 1] = log_s[:, i] + (carry - 0.5 * v_pos) * dt + root * z1[:, i]
        v = (
            v
            + model.kappa * (model.theta - v_pos) * dt
            + model.xi * root * (rho * z1[:, i] + rho_bar * z2[:, i])
        )
    return market.spot * np.exp(log_s)


def local_vol_paths(
    market: Market,
    model: LocalVol,
    expiry: float,
    steps: int,
    n_paths: int,
    rng: np.random.Generator,
    antithetic: bool = True,
) -> NDArray[np.float64]:
    """Local-volatility paths by Euler on log-spot."""
    _check(steps, n_paths, antithetic)
    dt = expiry / steps
    sqrt_dt = math.sqrt(dt)
    z = _normals(rng, n_paths, steps, antithetic)
    carry = market.rate - market.dividend_yield
    spots = np.empty((n_paths, steps + 1))
    spots[:, 0] = market.spot
    for i in range(steps):
        sigma = model(spots[:, i], i * dt)
        spots[:, i + 1] = spots[:, i] * np.exp(
            (carry - 0.5 * sigma**2) * dt + sigma * sqrt_dt * z[:, i]
        )
    return spots


#: Models whose paths need a fine time grid (no exact transition).
DISCRETISED_MODELS = (Heston, LocalVol)


def simulate_paths(
    market: Market,
    model: Model,
    expiry: float,
    steps: int,
    n_paths: int,
    rng: np.random.Generator,
    antithetic: bool = True,
) -> NDArray[np.float64]:
    """Dispatch to the path generator for `model`."""
    if isinstance(model, BlackScholes):
        return gbm_paths(market, model, expiry, steps, n_paths, rng, antithetic)
    if isinstance(model, Merton):
        return merton_paths(market, model, expiry, steps, n_paths, rng, antithetic)
    if isinstance(model, Heston):
        return heston_paths(market, model, expiry, steps, n_paths, rng, antithetic)
    if isinstance(model, LocalVol):
        return local_vol_paths(market, model, expiry, steps, n_paths, rng, antithetic)
    raise UnsupportedError(f"No path generator for the {type(model).__name__} model")
