"""Implied volatility: the volatility that makes a model price equal an observed price.

Option prices rise monotonically with volatility, so the inverse is unique whenever the price lies
strictly between the zero-volatility value and the price at a very high volatility. We bracket the
root and solve with Brent's method, which converges superlinearly and never leaves the bracket.

Works with any engine: Black–Scholes for European options, a tree for American ones.
Reference: Hull, ch. 15.11; Brent, Algorithms for Minimization without Derivatives (1973).
"""

import math
from dataclasses import dataclass

from scipy.optimize import brentq

from derivlab.engines import AnalyticEngine, PricingEngine
from derivlab.instruments import VanillaOption
from derivlab.market import Market
from derivlab.models import BlackScholes


@dataclass(frozen=True)
class ImpliedVolResult:
    volatility: float
    iterations: int
    #: Model price at the solution minus the target price.
    residual: float


def price_bounds(option: VanillaOption, market: Market) -> tuple[float, float]:
    """Model-free no-arbitrage bounds on the option price.

    European call: max(S e^-qT - K e^-rT, 0) <= C <= S e^-qT
    European put:  max(K e^-rT - S e^-qT, 0) <= P <= K e^-rT
    American options are also worth at least immediate exercise, and at most S (call) or K (put).
    """
    t = option.expiry
    spot, strike = market.spot, option.payoff.strike
    forward_gap = spot * math.exp(-market.dividend_yield * t) - strike * market.discount(t)
    sign = option.payoff.sign
    lower = max(sign * forward_gap, 0.0)
    if option.is_american:
        lower = max(lower, float(option.payoff(spot)))
        upper = spot if sign > 0 else strike
    else:
        upper = (
            spot * math.exp(-market.dividend_yield * t) if sign > 0 else strike * market.discount(t)
        )
    return lower, upper


def implied_volatility(
    price: float,
    option: VanillaOption,
    market: Market,
    engine: PricingEngine | None = None,
    vol_range: tuple[float, float] = (1e-4, 5.0),
    tolerance: float = 1e-10,
) -> ImpliedVolResult:
    """Solve engine.price(option, market, BlackScholes(sigma)).value == price for sigma.

    Raises ValueError when the price violates the no-arbitrage bounds, or when no volatility in
    `vol_range` reproduces it (e.g. a deep in-the-money American put priced at intrinsic value,
    where every low volatility gives the same price).
    """
    if option.expiry <= 0:
        raise ValueError("implied volatility needs a positive time to expiry")
    if not math.isfinite(price):
        raise ValueError("price must be finite")
    lower, upper = price_bounds(option, market)
    if not lower <= price < upper:
        raise ValueError(
            f"price {price:.6g} is outside the no-arbitrage range [{lower:.6g}, {upper:.6g})"
        )

    engine = engine or AnalyticEngine()

    def model_price(sigma: float) -> float:
        return engine.price(option, market, BlackScholes(sigma)).value

    vol_low, vol_high = vol_range
    # Some engines (CRR trees) are undefined at tiny volatilities; move the lower end up until
    # the engine can price there.
    while True:
        try:
            low_price = model_price(vol_low)
            break
        except ValueError:
            vol_low *= 2
            if vol_low >= vol_high:
                raise ValueError("engine cannot price anywhere in the volatility range") from None

    if price <= low_price + tolerance:
        raise ValueError(
            f"price {price:.6g} is at or below the near-zero-volatility value {low_price:.6g}; "
            "implied volatility is not identifiable"
        )
    if price >= model_price(vol_high):
        raise ValueError(f"implied volatility exceeds {vol_high:.0%}")

    root, info = brentq(
        lambda s: model_price(s) - price, vol_low, vol_high, xtol=tolerance, full_output=True
    )
    sigma = float(root)
    return ImpliedVolResult(sigma, info.iterations, model_price(sigma) - price)
