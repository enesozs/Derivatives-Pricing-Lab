"""Bump-and-revalue Greeks: finite differences of any engine's price.

Works for every engine, including ones with no Greeks of their own (most exotic Monte Carlo
engines will be like that). Central differences: error O(h^2) plus the engine's own noise
divided by h, so stochastic engines must reuse the same random numbers in the up and down runs
(common random numbers). Our Monte Carlo engine does that automatically through its fixed seed.
Reference: Glasserman, Monte Carlo Methods in Financial Engineering, ch. 7.1.
"""

from dataclasses import replace

from derivlab.engines import PricingEngine
from derivlab.instruments import VanillaOption
from derivlab.market import Market
from derivlab.models import BlackScholes
from derivlab.results import Greeks


def bump_greeks(
    engine: PricingEngine,
    option: VanillaOption,
    market: Market,
    model: BlackScholes,
    spot_bump: float = 0.01,
    vol_bump: float = 0.001,
    rate_bump: float = 0.0001,
    time_bump: float = 1 / 365,
) -> Greeks:
    """Greeks by re-pricing with bumped inputs. `spot_bump` is relative (1% of spot)."""

    def value(o: VanillaOption = option, m: Market = market, md: BlackScholes = model) -> float:
        return engine.price(o, m, md).value

    h = market.spot * spot_bump
    up, base, down = (
        value(m=replace(market, spot=market.spot + h)),
        value(),
        value(m=replace(market, spot=market.spot - h)),
    )
    dv = min(vol_bump, model.volatility / 2)
    dt = min(time_bump, option.expiry / 2)
    return Greeks(
        delta=(up - down) / (2 * h),
        gamma=(up - 2 * base + down) / h**2,
        vega=(
            value(md=replace(model, volatility=model.volatility + dv))
            - value(md=replace(model, volatility=model.volatility - dv))
        )
        / (2 * dv),
        # Theta: one step forward in calendar time = one step less to expiry.
        theta=(value(o=option.aged(dt)) - base) / dt,
        rho=(
            value(m=replace(market, rate=market.rate + rate_bump))
            - value(m=replace(market, rate=market.rate - rate_bump))
        )
        / (2 * rate_bump),
    )
