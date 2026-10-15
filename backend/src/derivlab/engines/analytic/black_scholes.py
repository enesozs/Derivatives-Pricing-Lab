"""Closed-form European prices: Black–Scholes–Merton, Merton jump-diffusion and SABR (Hagan).

- Black–Scholes: lognormal spot, constant volatility, analytic Greeks. Error: none beyond
  floating point; the benchmark the numerical engines are tested against.
- Merton: a Poisson-weighted sum of Black–Scholes prices, one per number of jumps n, each with
  variance sigma^2 + n sigma_j^2 / T and an adjusted rate. Truncated once the remaining Poisson
  weight is below 1e-14.
- SABR: Hagan's implied volatility plugged into Black–Scholes on the forward.
Greeks are analytic for Black–Scholes; for Merton and SABR use risk.bump_greeks.
References: Hull ch. 15 and 19; Merton (1976); Hagan et al. (2002).
"""

import math
from dataclasses import dataclass

import numpy as np
from numpy.typing import NDArray
from scipy.special import ndtr

from derivlab.core.errors import UnsupportedError
from derivlab.core.stats import norm_cdf, norm_pdf
from derivlab.instruments import VanillaOption
from derivlab.market import Market
from derivlab.models import SABR, BlackScholes, Merton, Model
from derivlab.results import Greeks, PricingResult

_MERTON_TAIL = 1e-14
_MERTON_MAX_TERMS = 200


def black_scholes(
    spot: float,
    strike: float,
    t: float,
    rate: float,
    dividend_yield: float,
    volatility: float,
    sign: int,
) -> tuple[float, Greeks | None]:
    """Scalar Black–Scholes value and Greeks (None at expiry or zero volatility)."""
    if t == 0:
        return max(sign * (spot - strike), 0.0), None
    discounted_spot = spot * math.exp(-dividend_yield * t)
    discounted_strike = strike * math.exp(-rate * t)
    if volatility == 0:
        return max(sign * (discounted_spot - discounted_strike), 0.0), None

    sigma_sqrt_t = volatility * math.sqrt(t)
    d1 = (
        math.log(spot / strike) + (rate - dividend_yield + 0.5 * volatility**2) * t
    ) / sigma_sqrt_t
    d2 = d1 - sigma_sqrt_t
    value = sign * (discounted_spot * norm_cdf(sign * d1) - discounted_strike * norm_cdf(sign * d2))
    pdf = norm_pdf(d1)
    greeks = Greeks(
        delta=sign * math.exp(-dividend_yield * t) * norm_cdf(sign * d1),
        gamma=discounted_spot * pdf / (spot * spot * sigma_sqrt_t),
        vega=discounted_spot * pdf * math.sqrt(t),
        theta=(
            -discounted_spot * pdf * volatility / (2 * math.sqrt(t))
            - sign * rate * discounted_strike * norm_cdf(sign * d2)
            + sign * dividend_yield * discounted_spot * norm_cdf(sign * d1)
        ),
        rho=sign * strike * t * math.exp(-rate * t) * norm_cdf(sign * d2),
    )
    return value, greeks


def merton_price(option: VanillaOption, market: Market, model: Merton) -> tuple[float, int]:
    """Merton (1976) series. Returns (value, number of terms used)."""
    t, strike, sign = option.expiry, option.payoff.strike, option.payoff.sign
    k = model.jump_compensator
    lam_prime = model.intensity * (1 + k)
    if t == 0 or lam_prime == 0:
        value, _ = black_scholes(
            market.spot, strike, t, market.rate, market.dividend_yield, model.volatility, sign
        )
        return value, 1
    mean = lam_prime * t
    weight = math.exp(-mean)
    total, cumulative = 0.0, 0.0
    for n in range(_MERTON_MAX_TERMS):
        if n > 0:
            weight *= mean / n
        sigma_n = math.sqrt(model.volatility**2 + n * model.jump_volatility**2 / t)
        rate_n = market.rate - model.intensity * k + n * math.log1p(k) / t
        value, _ = black_scholes(
            market.spot, strike, t, rate_n, market.dividend_yield, sigma_n, sign
        )
        # The Black–Scholes term discounts at rate_n; the series is defined with that discount.
        total += weight * value
        cumulative += weight
        if 1 - cumulative < _MERTON_TAIL and n > mean:
            return total, n + 1
    return total, _MERTON_MAX_TERMS


@dataclass(frozen=True)
class AnalyticEngine:
    def price(self, option: VanillaOption, market: Market, model: Model) -> PricingResult:
        if option.is_american:
            raise UnsupportedError("No closed form for American exercise; use a lattice engine")
        t, strike, sign = option.expiry, option.payoff.strike, option.payoff.sign

        if isinstance(model, BlackScholes):
            value, greeks = black_scholes(
                market.spot, strike, t, market.rate, market.dividend_yield, model.volatility, sign
            )
            return PricingResult(value, greeks=greeks)

        if isinstance(model, SABR):
            if t == 0:
                return PricingResult(float(option.payoff(market.spot)))
            vol = float(model.implied_volatility(market.forward(t), strike, t))
            value, _ = black_scholes(
                market.spot, strike, t, market.rate, market.dividend_yield, vol, sign
            )
            return PricingResult(value, diagnostics={"implied_vol": vol})

        if isinstance(model, Merton):
            value, terms = merton_price(option, market, model)
            return PricingResult(value, diagnostics={"terms": terms})

        raise UnsupportedError(
            f"No closed form for the {type(model).__name__} model; "
            "use the Fourier or Monte Carlo engine"
        )


def black_scholes_arrays(
    spot: NDArray[np.float64],
    strike: float,
    tau: float,
    rate: float,
    dividend_yield: float,
    volatility: float,
    sign: int,
) -> tuple[NDArray[np.float64], NDArray[np.float64]]:
    """Vectorised European value and delta over many spots (used by hedging simulations).

    `sign` is +1 for a call and -1 for a put. At tau = 0 returns the payoff and its slope.
    """
    if tau <= 0:
        intrinsic = np.maximum(sign * (spot - strike), 0.0)
        return intrinsic, np.where(sign * (spot - strike) > 0, float(sign), 0.0)
    width = volatility * math.sqrt(tau)
    d1 = (np.log(spot / strike) + (rate - dividend_yield + 0.5 * volatility**2) * tau) / width
    d2 = d1 - width
    carry = math.exp(-dividend_yield * tau)
    discount = math.exp(-rate * tau)
    value = sign * (spot * carry * ndtr(sign * d1) - strike * discount * ndtr(sign * d2))
    delta = sign * carry * ndtr(sign * d1)
    return value, delta
