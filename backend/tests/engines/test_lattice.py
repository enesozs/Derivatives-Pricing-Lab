from dataclasses import replace

import pytest

from derivlab import AnalyticEngine, CRREngine, Market
from tests.conftest import american, european


@pytest.mark.parametrize("kind", ["call", "put"])
def test_european_converges_to_black_scholes(kind, market, model):
    exact = AnalyticEngine().price(european(kind), market, model)
    tree = CRREngine(2000).price(european(kind), market, model)
    assert tree.value == pytest.approx(exact.value, abs=2e-3)
    assert tree.greeks is not None and exact.greeks is not None
    assert tree.greeks.delta == pytest.approx(exact.greeks.delta, abs=1e-3)
    assert tree.greeks.gamma == pytest.approx(exact.greeks.gamma, abs=1e-4)
    assert tree.greeks.vega == pytest.approx(exact.greeks.vega, rel=1e-2)
    assert tree.greeks.theta == pytest.approx(exact.greeks.theta, rel=1e-2)
    assert tree.greeks.rho == pytest.approx(exact.greeks.rho, rel=1e-2)


def test_american_put_reference(market, model):
    # Widely quoted benchmark for S=K=100, T=1, r=5%, sigma=20%: about 6.090.
    assert CRREngine(2000).price(american("put"), market, model).value == pytest.approx(
        6.090, abs=2e-3
    )


@pytest.mark.parametrize("kind", ["call", "put"])
def test_american_at_least_european(kind, market, model):
    engine = CRREngine(300)
    assert (
        engine.price(american(kind), market, model).value
        >= engine.price(european(kind), market, model).value - 1e-12
    )


def test_american_call_without_dividends_equals_european(market, model):
    engine = CRREngine(300)
    assert engine.price(american("call"), market, model).value == pytest.approx(
        engine.price(european("call"), market, model).value, abs=1e-10
    )


def test_american_call_with_dividends_has_early_exercise_premium(model):
    market = Market(100, 0.05, 0.08)
    engine = CRREngine(300)
    assert (
        engine.price(american("call"), market, model).value
        > engine.price(european("call"), market, model).value + 1e-3
    )


def test_deep_itm_american_put_is_exercised(model):
    market = Market(40, 0.05)
    assert CRREngine(300).price(american("put"), market, model).value == pytest.approx(60, abs=1e-9)


def test_invalid_probability_raises(market, model):
    with pytest.raises(ValueError, match="probability"):
        CRREngine(3).price(european(expiry=10), replace(market, rate=0.5), model)
