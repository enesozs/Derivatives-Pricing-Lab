"""Closed forms (and standard approximations) for two- and multi-asset options under correlated GBM.

- Exchange option (Margrabe 1978), exact: the ratio S1/S2 is itself lognormal, with variance
  sigma1^2 + sigma2^2 - 2 rho sigma1 sigma2, so it is a Black–Scholes call on the ratio.
- Spread option, Kirk (1995) approximation: treat S2 + K as lognormal. Accurate for small K.
- Basket option, Levy (1992) approximation: match the first two moments of the arithmetic
  basket with a lognormal. The geometric basket is exactly lognormal (used as a control
  variate in Monte Carlo).
- Best-of / worst-of two assets (Stulz 1982), exact, via the bivariate normal CDF.
- Quanto: exact, a Black–Scholes price with the drift shifted by -rho sigma_S sigma_FX.
Higher correlation shrinks the variance of S1 - S2, so exchange/spread options and best-of
options get cheaper, while baskets and worst-of options get dearer.
Reference: Haug, The Complete Guide to Option Pricing Formulas (2007), ch. 5.
"""

import math
from dataclasses import dataclass

import numpy as np

from derivlab.core.bivariate import bivariate_normal_cdf as M
from derivlab.core.errors import UnsupportedError
from derivlab.core.stats import norm_cdf as N
from derivlab.results import PricingResult

from .instruments import BasketOption, ExchangeOption, QuantoOption, RainbowOption, SpreadOption
from .market import CorrelatedBlackScholes, MultiAssetMarket, QuantoMarket, QuantoModel


def _pair(
    market: MultiAssetMarket, model: CorrelatedBlackScholes
) -> tuple[float, float, float, float, float, float, float]:
    if market.size != 2:
        raise UnsupportedError("this closed form is for exactly two assets; use Monte Carlo")
    s1, s2 = market.spots
    q1, q2 = market.dividend_yields
    v1, v2 = model.volatilities
    return s1, s2, q1, q2, v1, v2, float(model.matrix[0, 1])


def margrabe(
    market: MultiAssetMarket, model: CorrelatedBlackScholes, option: ExchangeOption
) -> float:
    s1, s2, q1, q2, v1, v2, rho = _pair(market, model)
    s1, s2 = option.quantity_1 * s1, option.quantity_2 * s2
    t = option.expiry
    sigma = math.sqrt(max(v1 * v1 + v2 * v2 - 2 * rho * v1 * v2, 1e-16))
    d1 = (math.log(s1 / s2) + (q2 - q1 + 0.5 * sigma**2) * t) / (sigma * math.sqrt(t))
    d2 = d1 - sigma * math.sqrt(t)
    return s1 * math.exp(-q1 * t) * N(d1) - s2 * math.exp(-q2 * t) * N(d2)


def kirk(market: MultiAssetMarket, model: CorrelatedBlackScholes, option: SpreadOption) -> float:
    _, _, _, _, v1, v2, rho = _pair(market, model)
    t, k = option.expiry, option.strike
    f1, f2 = market.forwards(t)
    ratio = f2 / (f2 + k)
    sigma = math.sqrt(v1 * v1 - 2 * rho * v1 * v2 * ratio + (v2 * ratio) ** 2)
    width = sigma * math.sqrt(t)
    d1 = (math.log(f1 / (f2 + k)) + 0.5 * width**2) / width
    d2 = d1 - width
    call = market.discount(t) * (f1 * N(d1) - (f2 + k) * N(d2))
    if option.kind == "call":
        return call
    return call - market.discount(t) * (f1 - f2 - k)  # put–call parity for spreads


def _basket_moments(
    market: MultiAssetMarket, model: CorrelatedBlackScholes, weights: np.ndarray, t: float
) -> tuple[float, float]:
    f = weights * market.forwards(t)
    m1 = float(f.sum())
    m2 = float(f @ np.exp(model.covariance(t)) @ f)
    return m1, m2


def levy_basket(
    market: MultiAssetMarket, model: CorrelatedBlackScholes, option: BasketOption
) -> float:
    t = option.expiry
    weights = np.array(option.weights, dtype=float)
    if len(weights) != market.size:
        raise ValueError("one weight per asset")
    m1, m2 = _basket_moments(market, model, weights, t)
    variance = math.log(m2 / (m1 * m1))
    width = math.sqrt(variance)
    sign = 1 if option.kind == "call" else -1
    d1 = (math.log(m1 / option.strike) + 0.5 * variance) / width
    d2 = d1 - width
    return market.discount(t) * sign * (m1 * N(sign * d1) - option.strike * N(sign * d2))


def geometric_basket(
    market: MultiAssetMarket, model: CorrelatedBlackScholes, option: BasketOption
) -> float:
    """Exact price of the geometric analogue: payoff on (sum w) * prod S_i^(w_i / sum w)."""
    t = option.expiry
    w = np.array(option.weights, dtype=float)
    a = w / w.sum()
    s, q, v = np.array(market.spots), np.array(market.dividend_yields), np.array(model.volatilities)
    mean = math.log(w.sum()) + float(a @ (np.log(s) + (market.rate - q - 0.5 * v * v) * t))
    variance = float(a @ model.covariance(t) @ a)
    width = math.sqrt(variance)
    sign = 1 if option.kind == "call" else -1
    d1 = (mean - math.log(option.strike) + variance) / width
    d2 = d1 - width
    forward = math.exp(mean + 0.5 * variance)
    return market.discount(t) * sign * (forward * N(sign * d1) - option.strike * N(sign * d2))


def stulz(market: MultiAssetMarket, model: CorrelatedBlackScholes, option: RainbowOption) -> float:
    s1, s2, q1, q2, v1, v2, rho = _pair(market, model)
    t, x, r = option.expiry, option.strike, market.rate
    b1, b2 = r - q1, r - q2
    sqt = math.sqrt(t)
    sigma = math.sqrt(max(v1 * v1 + v2 * v2 - 2 * rho * v1 * v2, 1e-16))
    rho1 = (v1 - rho * v2) / sigma
    rho2 = (v2 - rho * v1) / sigma
    d = (math.log(s1 / s2) + (b1 - b2 + 0.5 * sigma**2) * t) / (sigma * sqt)
    exchange = margrabe(market, model, ExchangeOption(t))
    carry1, carry2 = s1 * math.exp((b1 - r) * t), s2 * math.exp((b2 - r) * t)
    disc = math.exp(-r * t)

    def call(strike: float) -> float:
        if strike <= 0:  # a claim on the min or max itself
            return carry1 - exchange if option.style == "worst" else carry2 + exchange
        y1 = (math.log(s1 / strike) + (b1 + 0.5 * v1 * v1) * t) / (v1 * sqt)
        y2 = (math.log(s2 / strike) + (b2 + 0.5 * v2 * v2) * t) / (v2 * sqt)
        if option.style == "worst":
            return (
                carry1 * M(y1, -d, -rho1)
                + carry2 * M(y2, d - sigma * sqt, -rho2)
                - strike * disc * M(y1 - v1 * sqt, y2 - v2 * sqt, rho)
            )
        return (
            carry1 * M(y1, d, rho1)
            + carry2 * M(y2, -d + sigma * sqt, rho2)
            - strike * disc * (1 - M(-y1 + v1 * sqt, -y2 + v2 * sqt, rho))
        )

    if option.kind == "call":
        return call(x)
    return x * disc - call(0.0) + call(x)


def quanto_price(option: QuantoOption, market: QuantoMarket, model: QuantoModel) -> float:
    t = option.expiry
    adjusted_carry = (
        market.foreign_rate
        - market.dividend_yield
        - model.correlation * model.asset_volatility * model.fx_volatility
    )
    forward = market.spot * math.exp(adjusted_carry * t)
    width = model.asset_volatility * math.sqrt(t)
    d1 = (math.log(forward / option.strike) + 0.5 * width**2) / width
    d2 = d1 - width
    sign = option.sign
    return (
        option.fixed_fx
        * math.exp(-market.domestic_rate * t)
        * sign
        * (forward * N(sign * d1) - option.strike * N(sign * d2))
    )


@dataclass(frozen=True)
class MultiAssetAnalyticEngine:
    def price(
        self, option, market: MultiAssetMarket, model: CorrelatedBlackScholes
    ) -> PricingResult:
        if isinstance(option, ExchangeOption):
            return PricingResult(
                margrabe(market, model, option), diagnostics={"method": "Margrabe (exact)"}
            )
        if isinstance(option, SpreadOption):
            if option.strike == 0:
                value = margrabe(market, model, ExchangeOption(option.expiry))
                if option.kind == "put":
                    value -= market.discount(option.expiry) * float(
                        np.subtract(*market.forwards(option.expiry))
                    )
                return PricingResult(value, diagnostics={"method": "Margrabe (exact, K = 0)"})
            return PricingResult(
                kirk(market, model, option), diagnostics={"method": "Kirk (approximation)"}
            )
        if isinstance(option, BasketOption):
            return PricingResult(
                levy_basket(market, model, option),
                diagnostics={"method": "Levy moment matching (approximation)"},
            )
        if isinstance(option, RainbowOption):
            return PricingResult(
                stulz(market, model, option), diagnostics={"method": "Stulz (exact, two assets)"}
            )
        raise UnsupportedError(f"No multi-asset closed form for {type(option).__name__}")
