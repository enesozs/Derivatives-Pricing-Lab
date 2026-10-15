import pytest

from derivlab import AnalyticEngine, BinomialEngine, MonteCarloEngine
from derivlab.risk import bump_greeks
from tests.conftest import american, european


def test_bumped_analytic_matches_closed_form(market, model):
    exact = AnalyticEngine().price(european(), market, model).greeks
    bumped = bump_greeks(AnalyticEngine(), european(), market, model)
    assert exact is not None
    assert bumped.delta == pytest.approx(exact.delta, abs=1e-4)
    assert bumped.gamma == pytest.approx(exact.gamma, abs=1e-4)
    assert bumped.vega == pytest.approx(exact.vega, rel=1e-4)
    assert bumped.rho == pytest.approx(exact.rho, rel=1e-4)
    assert bumped.theta == pytest.approx(exact.theta, rel=1e-2)  # one-sided in time


def test_monte_carlo_with_common_random_numbers(market, model):
    exact = AnalyticEngine().price(european(), market, model).greeks
    bumped = bump_greeks(MonteCarloEngine(paths=200_000, greeks=False), european(), market, model)
    assert exact is not None
    assert bumped.delta == pytest.approx(exact.delta, abs=5e-3)


def test_works_for_american_trees(market, model):
    bumped = bump_greeks(
        BinomialEngine(501, "leisen-reimer", greeks=False), american(), market, model
    )
    assert -1 < bumped.delta < 0 and bumped.gamma > 0 and bumped.vega > 0
