"""Black–Scholes closed forms for exotic options.

- Digitals: cash-or-nothing e^{-rT} N(+/-d2), asset-or-nothing S e^{-qT} N(+/-d1).
- Barriers (continuous monitoring): Reiner & Rubinstein (1991), via Haug's A-D building blocks,
  for all eight up/down, in/out, call/put cases. Discrete monitoring with m dates uses the
  Broadie–Glasserman–Kou (1997) continuity correction: price the continuous barrier shifted
  away from spot by exp(0.5826 sigma sqrt(T/m)). It is an approximation, accurate unless the
  barrier is very close to spot.
- Asians: the geometric average of lognormal prices is lognormal, so a discrete geometric
  fixed-strike Asian has an exact Black-like formula. Arithmetic Asians have none; Monte Carlo
  uses the geometric price as a control variate.
- Lookbacks (continuous): Goldman, Sosin & Gatto (1979) floating strike and Conze &
  Viswanathan (1991) fixed strike, at inception (running extreme = spot).
Reference: Haug, The Complete Guide to Option Pricing Formulas (2007), ch. 4.
"""

import math

from derivlab.core.stats import norm_cdf as N
from derivlab.instruments import AsianOption, BarrierOption, DigitalOption, LookbackOption
from derivlab.market import Market

from .black_scholes import black_scholes

BGK_BETA = 0.5826  # -zeta(1/2) / sqrt(2 pi)


def digital_price(option: DigitalOption, market: Market, sigma: float) -> float:
    s, k, t, sign = market.spot, option.strike, option.expiry, option.sign
    r, q = market.rate, market.dividend_yield
    width = sigma * math.sqrt(t)
    d1 = (math.log(s / k) + (r - q + 0.5 * sigma**2) * t) / width
    d2 = d1 - width
    if option.payout == "cash":
        return option.cash * math.exp(-r * t) * N(sign * d2)
    return s * math.exp(-q * t) * N(sign * d1)


def effective_barrier(option: BarrierOption, sigma: float) -> float:
    """The continuous barrier that mimics the option's discrete monitoring (BGK shift)."""
    if option.observations is None:
        return option.barrier
    shift = math.exp(BGK_BETA * sigma * math.sqrt(option.expiry / option.observations))
    return option.barrier * shift if option.direction == "up" else option.barrier / shift


def barrier_price(option: BarrierOption, market: Market, sigma: float) -> float:
    s, x, t = market.spot, option.strike, option.expiry
    r, q = market.rate, market.dividend_yield
    vanilla, _ = black_scholes(s, x, t, r, q, sigma, option.vanilla.sign)
    if option.breached(s):  # already touched: knocked in (worth the vanilla) or out (worthless)
        return vanilla if option.knock == "in" else 0.0

    h = effective_barrier(option, sigma)
    b = r - q
    sigma_sqrt_t = sigma * math.sqrt(t)
    mu = (b - 0.5 * sigma**2) / sigma**2
    phi = 1 if option.kind == "call" else -1
    eta = 1 if option.direction == "down" else -1
    carry = math.exp((b - r) * t)
    disc = math.exp(-r * t)

    x1 = math.log(s / x) / sigma_sqrt_t + (1 + mu) * sigma_sqrt_t
    x2 = math.log(s / h) / sigma_sqrt_t + (1 + mu) * sigma_sqrt_t
    y1 = math.log(h * h / (s * x)) / sigma_sqrt_t + (1 + mu) * sigma_sqrt_t
    y2 = math.log(h / s) / sigma_sqrt_t + (1 + mu) * sigma_sqrt_t
    hs = h / s

    a = phi * s * carry * N(phi * x1) - phi * x * disc * N(phi * x1 - phi * sigma_sqrt_t)
    bb = phi * s * carry * N(phi * x2) - phi * x * disc * N(phi * x2 - phi * sigma_sqrt_t)
    c = phi * s * carry * hs ** (2 * (mu + 1)) * N(eta * y1) - phi * x * disc * hs ** (2 * mu) * N(
        eta * y1 - eta * sigma_sqrt_t
    )
    d = phi * s * carry * hs ** (2 * (mu + 1)) * N(eta * y2) - phi * x * disc * hs ** (2 * mu) * N(
        eta * y2 - eta * sigma_sqrt_t
    )

    above = x > h  # strike above the barrier
    case = (option.direction, option.knock, option.kind)
    table = {
        ("down", "in", "call"): c if above else a - bb + d,
        ("up", "in", "call"): a if above else bb - c + d,
        ("down", "in", "put"): bb - c + d if above else a,
        ("up", "in", "put"): a - bb + d if above else c,
        ("down", "out", "call"): a - c if above else bb - d,
        ("up", "out", "call"): 0.0 if above else a - bb + c - d,
        ("down", "out", "put"): a - bb + c - d if above else 0.0,
        ("up", "out", "put"): bb - d if above else a - c,
    }
    return max(table[case], 0.0)


def geometric_asian_price(option: AsianOption, market: Market, sigma: float) -> float:
    """Discrete geometric average, fixed strike: ln G is normal with known mean and variance."""
    times = option.fixing_times()
    s, k = market.spot, option.strike
    r, q = market.rate, market.dividend_yield
    mean = math.log(s) + (r - q - 0.5 * sigma**2) * float(times.mean())
    n = len(times)
    # Var(ln G) = sigma^2 / n^2 * sum_ij min(t_i, t_j).
    variance = sigma**2 / n**2 * float(sum((2 * (n - i) - 1) * t for i, t in enumerate(times)))
    width = math.sqrt(variance)
    forward_g = math.exp(mean + 0.5 * variance)
    d1 = (mean - math.log(k) + variance) / width
    d2 = d1 - width
    sign = option.sign
    return math.exp(-r * option.expiry) * sign * (forward_g * N(sign * d1) - k * N(sign * d2))


def lookback_price(option: LookbackOption, market: Market, sigma: float) -> float:
    """Continuous-monitoring lookbacks at inception (running min = running max = spot)."""
    s, t = market.spot, option.expiry
    r, q = market.rate, market.dividend_yield
    b = r - q
    if abs(b) < 1e-6:
        b = 1e-6  # the formulas have a removable singularity at b = 0
    sst = sigma * math.sqrt(t)
    carry = math.exp((b - r) * t)
    disc = math.exp(-r * t)
    ratio = sigma**2 / (2 * b)

    if option.strike_type == "floating":
        a1 = (b + 0.5 * sigma**2) * t / sst  # ln(S / S_extreme) = 0 at inception
        a2 = a1 - sst
        if option.kind == "call":
            return (
                s * carry * N(a1)
                - s * disc * N(a2)
                + s
                * disc
                * ratio
                * (N(-a1 + 2 * b * math.sqrt(t) / sigma) - math.exp(b * t) * N(-a1))
            )
        return (
            s * disc * N(-a2)
            - s * carry * N(-a1)
            + s * disc * ratio * (-N(a1 - 2 * b * math.sqrt(t) / sigma) + math.exp(b * t) * N(a1))
        )

    k = option.strike
    if option.kind == "call":
        level = max(k, s)  # if K <= S the payoff is at least S - K: value it from S
        d1 = (math.log(s / level) + (b + 0.5 * sigma**2) * t) / sst
        d2 = d1 - sst
        value = (
            s * carry * N(d1)
            - level * disc * N(d2)
            + s
            * disc
            * ratio
            * (
                -((s / level) ** (-2 * b / sigma**2)) * N(d1 - 2 * b * math.sqrt(t) / sigma)
                + math.exp(b * t) * N(d1)
            )
        )
        return value + disc * max(s - k, 0.0)
    level = min(k, s)
    d1 = (math.log(s / level) + (b + 0.5 * sigma**2) * t) / sst
    d2 = d1 - sst
    value = (
        -s * carry * N(-d1)
        + level * disc * N(-d2)
        + s
        * disc
        * ratio
        * (
            (s / level) ** (-2 * b / sigma**2) * N(-d1 + 2 * b * math.sqrt(t) / sigma)
            - math.exp(b * t) * N(-d1)
        )
    )
    return value + disc * max(k - s, 0.0)
