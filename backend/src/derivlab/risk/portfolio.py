"""Portfolio risk across mixed products: aggregated Greeks, stress grids and scenarios.

Every position is revalued in full under each scenario (spot, volatility and rate shocks),
whatever its pricing method: closed form, Fourier or Monte Carlo with a fixed seed (common
random numbers keep bumped differences smooth). Greeks are central bump-and-revalue
differences of the whole book, so they include products with no analytic Greeks.

The scenario report compares full revaluation with the second-order Taylor estimate
  dV ~ Delta dS + 1/2 Gamma dS^2 + Vega dsigma + Rho dr.
They agree for small moves; for large moves (a crash, a barrier crossed) the Taylor estimate
fails. That gap is why risk systems stress books by full revaluation.
Reference: Hull ch. 22 (VaR and stress testing); Glasserman ch. 9.
"""

import math
from dataclasses import dataclass, replace

import numpy as np
from numpy.typing import NDArray

from derivlab.core.errors import UnsupportedError
from derivlab.instruments import Instrument
from derivlab.market import Market
from derivlab.models import BlackScholes, Heston, Model
from derivlab.structured import Autocallable, ReverseConvertible, price_autocallable
from derivlab.structured._common import price_instrument

Product = Instrument | ReverseConvertible | Autocallable

#: Paths for Monte Carlo-priced positions under revaluation (fixed seed throughout).
RISK_PATHS = 20_000


@dataclass(frozen=True)
class Position:
    product: Product
    #: Number of options, or notional for notes (negative = short, e.g. the issuer's side).
    quantity: float
    label: str = ""


@dataclass(frozen=True)
class Scenario:
    name: str
    #: Relative spot move (-0.2 = down 20%).
    spot: float = 0.0
    #: Absolute volatility move (0.05 = +5 vol points).
    vol: float = 0.0
    #: Absolute rate move (0.01 = +100bp).
    rate: float = 0.0


STRESS_SCENARIOS = (
    Scenario("Crash: spot −25%, vol +20pts", -0.25, 0.20),
    Scenario("Sell-off: spot −10%, vol +8pts", -0.10, 0.08),
    Scenario("Grind lower: spot −5%, vol +2pts", -0.05, 0.02),
    Scenario("Rally: spot +10%, vol −5pts", 0.10, -0.05),
    Scenario("Vol spike: vol +10pts", 0.0, 0.10),
    Scenario("Vol crush: vol −8pts", 0.0, -0.08),
    Scenario("Rates +100bp", 0.0, 0.0, 0.01),
)


def shock(market: Market, model: Model, scenario: Scenario) -> tuple[Market, Model]:
    """Apply a scenario. For Heston, the volatility shift moves sqrt(v0) and sqrt(theta)."""
    shocked = replace(
        market, spot=market.spot * (1 + scenario.spot), rate=market.rate + scenario.rate
    )
    if isinstance(model, BlackScholes):
        return shocked, BlackScholes(max(model.volatility + scenario.vol, 1e-4))

    if isinstance(model, Heston):

        def bump(v: float) -> float:
            return max(math.sqrt(v) + scenario.vol, 1e-3) ** 2

        return shocked, replace(model, v0=bump(model.v0), theta=bump(model.theta))
    raise UnsupportedError(f"No volatility shock defined for {type(model).__name__}")


def unit_value(
    product: Product, market: Market, model: Model, reference: float | None = None
) -> float:
    """Value of one option, or of one unit of a note's notional. Notes' levels refer to the
    initial fixing `reference` (default: today's spot); options carry absolute strikes."""
    if isinstance(product, ReverseConvertible):
        return product.value(market, model, reference)
    if isinstance(product, Autocallable):
        return price_autocallable(product, market, model, RISK_PATHS, 11, reference).value
    return price_instrument(product, market, model, mc_paths=RISK_PATHS)


def revalue(
    positions: list[Position], market: Market, model: Model, scenario: Scenario | None = None
) -> NDArray[np.float64]:
    """Value of each position (quantity included), optionally under a scenario. Notes keep
    today's spot as their fixing, so a spot shock moves their performance."""
    m, mod = (market, model) if scenario is None else shock(market, model, scenario)
    return np.array([p.quantity * unit_value(p.product, m, mod, market.spot) for p in positions])


@dataclass(frozen=True)
class PortfolioRisk:
    values: NDArray[np.float64]
    #: Per position, in currency: delta (per 1 unit of spot), gamma, vega (per vol point),
    #: rho (per 1% rate).
    delta: NDArray[np.float64]
    gamma: NDArray[np.float64]
    vega: NDArray[np.float64]
    rho: NDArray[np.float64]

    @property
    def total(self) -> float:
        return float(self.values.sum())

    def taylor(self, spot: float, scenario: Scenario) -> float:
        """Second-order estimate of the book's P&L under `scenario`."""
        ds = spot * scenario.spot
        return float(
            self.delta.sum() * ds
            + 0.5 * self.gamma.sum() * ds * ds
            + self.vega.sum() * scenario.vol * 100
            + self.rho.sum() * scenario.rate * 100
        )


def portfolio_risk(
    positions: list[Position],
    market: Market,
    model: Model,
    spot_bump: float = 0.01,
    vol_bump: float = 0.01,
    rate_bump: float = 0.0001,
) -> PortfolioRisk:
    """Central bump-and-revalue Greeks for every position."""

    def at(**kw: float) -> NDArray[np.float64]:
        return revalue(positions, market, model, Scenario("bump", **kw))

    base = revalue(positions, market, model)
    up, down = at(spot=spot_bump), at(spot=-spot_bump)
    ds = market.spot * spot_bump
    vol_up, vol_down = at(vol=vol_bump), at(vol=-vol_bump)
    rate_up, rate_down = at(rate=rate_bump), at(rate=-rate_bump)
    return PortfolioRisk(
        values=base,
        delta=(up - down) / (2 * ds),
        gamma=(up - 2 * base + down) / (ds * ds),
        vega=(vol_up - vol_down) / (2 * vol_bump) * 0.01,
        rho=(rate_up - rate_down) / (2 * rate_bump) * 0.01,
    )


def stress_grid(
    positions: list[Position],
    market: Market,
    model: Model,
    spot_shifts: list[float],
    vol_shifts: list[float],
) -> NDArray[np.float64]:
    """Book P&L for every (vol shift, spot shift) pair; rows are vol shifts."""
    base = revalue(positions, market, model).sum()
    return np.array(
        [
            [
                revalue(positions, market, model, Scenario("grid", s, v)).sum() - base
                for s in spot_shifts
            ]
            for v in vol_shifts
        ]
    )


@dataclass(frozen=True)
class ScenarioResult:
    name: str
    #: Book P&L by full revaluation.
    full: float
    #: Book P&L estimated from the Greeks.
    taylor: float


def scenario_report(
    positions: list[Position],
    market: Market,
    model: Model,
    scenarios: tuple[Scenario, ...] = STRESS_SCENARIOS,
    risk: PortfolioRisk | None = None,
) -> list[ScenarioResult]:
    """Full-revaluation P&L next to the Greek (Taylor) estimate for each scenario."""
    risk = risk or portfolio_risk(positions, market, model)
    return [
        ScenarioResult(
            sc.name,
            float(revalue(positions, market, model, sc).sum() - risk.total),
            risk.taylor(market.spot, sc),
        )
        for sc in scenarios
    ]
