"""Monte Carlo for multi-asset options: correlated GBM via the Cholesky factor.

If Z has independent standard normal components, L Z (with L L^T = correlation) has the
desired correlation. Each asset then gets the exact lognormal step. Monte Carlo's error rate
does not depend on the number of assets, which is why it is the method of choice beyond two
or three underlyings, where trees and PDE grids become infeasible.

Basket calls and puts use the geometric basket (exact closed form, highly correlated) as a
control variate; other payoffs use the discounted first asset.
"""

import math
from dataclasses import dataclass

import numpy as np
from numpy.typing import NDArray

from derivlab.results import PricingResult

from .analytic import geometric_basket
from .instruments import BasketOption, QuantoOption
from .market import CorrelatedBlackScholes, MultiAssetMarket, QuantoMarket, QuantoModel


def correlated_paths(
    market: MultiAssetMarket,
    model: CorrelatedBlackScholes,
    expiry: float,
    steps: int,
    n_paths: int,
    rng: np.random.Generator,
    antithetic: bool = True,
) -> NDArray[np.float64]:
    """Spots of shape (n_paths, steps + 1, n_assets)."""
    n = market.size
    dt = expiry / steps
    if antithetic:
        half = rng.standard_normal((n_paths // 2, steps, n))
        z = np.concatenate([half, -half])
    else:
        z = rng.standard_normal((n_paths, steps, n))
    correlated = z @ model.cholesky().T
    vols = np.array(model.volatilities)
    drift = (market.rate - np.array(market.dividend_yields) - 0.5 * vols**2) * dt
    increments = drift + vols * math.sqrt(dt) * correlated
    log_paths = np.concatenate([np.zeros((n_paths, 1, n)), np.cumsum(increments, axis=1)], axis=1)
    return np.array(market.spots) * np.exp(log_paths)


def _stats(samples: NDArray[np.float64], antithetic: bool) -> tuple[float, float]:
    if antithetic:
        half = len(samples) // 2
        independent = 0.5 * (samples[:half] + samples[half:])
    else:
        independent = samples
    return float(samples.mean()), float(np.std(independent, ddof=1) / math.sqrt(len(independent)))


@dataclass(frozen=True)
class MultiAssetMonteCarloEngine:
    paths: int = 100_000
    seed: int = 42
    antithetic: bool = True
    control_variate: bool = True

    def price(
        self, option, market: MultiAssetMarket, model: CorrelatedBlackScholes
    ) -> PricingResult:
        t = option.expiry
        rng = np.random.default_rng(self.seed)
        paths = self.paths + self.paths % 2
        terminal = correlated_paths(market, model, t, 1, paths, rng, self.antithetic)[:, -1, :]
        discount = market.discount(t)
        samples = discount * option.payoff(terminal)
        diagnostics: dict[str, float | int | str] = {"paths": paths}
        if self.control_variate:
            if isinstance(option, BasketOption):
                w = np.array(option.weights, dtype=float)
                geometric = w.sum() * np.exp(np.log(terminal) @ (w / w.sum()))
                sign = 1 if option.kind == "call" else -1
                control = discount * np.maximum(sign * (geometric - option.strike), 0.0)
                expected = geometric_basket(market, model, option)
                diagnostics["control_variate"] = "geometric basket"
            else:
                control = discount * terminal[:, 0]
                expected = market.spots[0] * math.exp(-market.dividend_yields[0] * t)
            variance = np.var(control, ddof=1)
            if variance > 0:
                beta = np.cov(samples, control, ddof=1)[0, 1] / variance
                samples = samples - beta * (control - expected)
        value, stderr = _stats(samples, self.antithetic)
        return PricingResult(value, stderr=stderr, diagnostics=diagnostics)


def quanto_monte_carlo(
    option: QuantoOption,
    market: QuantoMarket,
    model: QuantoModel,
    paths: int = 100_000,
    seed: int = 42,
) -> PricingResult:
    """Simulate the asset and the FX rate jointly under the *domestic* risk-neutral measure.

    There the FX rate (domestic per foreign) drifts at r_d - r_f, and the foreign asset's drift
    picks up -rho sigma_S sigma_X from the change of measure. That is the quanto adjustment
    the closed form uses, here produced by simulation of the pair.
    """
    t = option.expiry
    rng = np.random.default_rng(seed)
    paths += paths % 2
    half = rng.standard_normal((paths // 2, 2))
    z = np.concatenate([half, -half])
    rho = model.correlation
    z_s = z[:, 0]
    z_x = rho * z[:, 0] + math.sqrt(1 - rho * rho) * z[:, 1]
    s_vol, x_vol = model.asset_volatility, model.fx_volatility
    drift_s = market.foreign_rate - market.dividend_yield - rho * s_vol * x_vol - 0.5 * s_vol**2
    terminal = market.spot * np.exp(drift_s * t + s_vol * math.sqrt(t) * z_s)
    fx_growth = np.exp(
        (market.domestic_rate - market.foreign_rate - 0.5 * x_vol**2) * t
        + x_vol * math.sqrt(t) * z_x
    )
    payoff = option.fixed_fx * np.maximum(option.sign * (terminal - option.strike), 0.0)
    samples = math.exp(-market.domestic_rate * t) * payoff
    value, stderr = _stats(samples, True)
    return PricingResult(
        value,
        stderr=stderr,
        diagnostics={"paths": paths, "mean_fx_growth": float(fx_growth.mean())},
    )
