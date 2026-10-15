"""Black–Scholes–Merton closed form for European vanilla options, with analytic Greeks.

Model: GBM with constant rate r, continuous dividend yield q and volatility sigma.
Error: none beyond floating point — this is the benchmark the numerical engines are tested against.
Reference: Hull, Options, Futures, and Other Derivatives, ch. 15 and 19.
"""

import math
from dataclasses import dataclass

from derivlab.core.errors import UnsupportedError
from derivlab.core.stats import norm_cdf, norm_pdf
from derivlab.instruments import VanillaOption
from derivlab.market import Market
from derivlab.models import BlackScholes
from derivlab.results import Greeks, PricingResult


@dataclass(frozen=True)
class AnalyticEngine:
    def price(self, option: VanillaOption, market: Market, model: BlackScholes) -> PricingResult:
        if option.is_american:
            raise UnsupportedError("No closed form for American exercise; use a lattice engine")

        spot, strike, t = market.spot, option.payoff.strike, option.expiry
        if t == 0:
            # At expiry the option is worth its payoff; Greeks are undefined at the kink.
            return PricingResult(float(option.payoff(spot)))

        discounted_spot = spot * math.exp(-market.dividend_yield * t)
        discounted_strike = strike * market.discount(t)
        sign = option.payoff.sign
        if model.volatility == 0:
            # Deterministic forward: pay the discounted forward intrinsic value.
            return PricingResult(max(sign * (discounted_spot - discounted_strike), 0.0))

        sigma_sqrt_t = model.volatility * math.sqrt(t)
        d1 = (
            math.log(spot / strike)
            + (market.rate - market.dividend_yield + 0.5 * model.volatility**2) * t
        ) / sigma_sqrt_t
        d2 = d1 - sigma_sqrt_t

        value = sign * (
            discounted_spot * norm_cdf(sign * d1) - discounted_strike * norm_cdf(sign * d2)
        )
        pdf = norm_pdf(d1)
        greeks = Greeks(
            delta=sign * math.exp(-market.dividend_yield * t) * norm_cdf(sign * d1),
            gamma=discounted_spot * pdf / (spot * spot * sigma_sqrt_t),
            vega=discounted_spot * pdf * math.sqrt(t),
            theta=(
                -discounted_spot * pdf * model.volatility / (2 * math.sqrt(t))
                - sign * market.rate * discounted_strike * norm_cdf(sign * d2)
                + sign * market.dividend_yield * discounted_spot * norm_cdf(sign * d1)
            ),
            rho=sign * strike * t * market.discount(t) * norm_cdf(sign * d2),
        )
        return PricingResult(value, greeks=greeks)
