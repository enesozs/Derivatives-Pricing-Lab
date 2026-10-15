import pytest

from derivlab import AnalyticEngine, BlackScholes, Market, MonteCarloEngine
from tests.conftest import european


@pytest.mark.parametrize("kind", ["call", "put"])
def test_pathwise_and_likelihood_ratio_greeks(kind):
    market = Market(100, 0.05, 0.02)
    model = BlackScholes(0.25)
    option = european(kind, strike=105, expiry=0.75)
    exact = AnalyticEngine().price(option, market, model).greeks
    estimate = MonteCarloEngine(paths=400_000, seed=1).price(option, market, model).greeks
    assert exact is not None and estimate is not None
    assert estimate.delta == pytest.approx(exact.delta, abs=3e-3)
    assert estimate.vega == pytest.approx(exact.vega, rel=2e-2)
    assert estimate.rho == pytest.approx(exact.rho, rel=2e-2)
    assert estimate.theta == pytest.approx(exact.theta, rel=2e-2)
    assert estimate.gamma == pytest.approx(exact.gamma, rel=6e-2)  # likelihood ratio: noisier


def test_greeks_can_be_switched_off(market, model):
    assert (
        MonteCarloEngine(paths=1000, greeks=False).price(european(), market, model).greeks is None
    )
