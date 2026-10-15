from dataclasses import replace

import pytest

from derivlab import AnalyticEngine, BinomialEngine, BlackScholes, Market
from derivlab.engines.lattice import tree_nodes
from tests.conftest import american, european

SCHEMES = ["crr", "jarrow-rudd", "leisen-reimer"]


@pytest.mark.parametrize("scheme", SCHEMES)
@pytest.mark.parametrize("kind", ["call", "put"])
def test_european_converges_to_black_scholes(scheme, kind, market, model):
    exact = AnalyticEngine().price(european(kind), market, model)
    tree = BinomialEngine(2001, scheme).price(european(kind), market, model)
    assert tree.value == pytest.approx(exact.value, abs=2e-3)
    assert tree.greeks is not None and exact.greeks is not None
    assert tree.greeks.delta == pytest.approx(exact.greeks.delta, abs=1e-3)
    assert tree.greeks.gamma == pytest.approx(exact.greeks.gamma, abs=2e-4)
    assert tree.greeks.vega == pytest.approx(exact.greeks.vega, rel=1e-2)
    assert tree.greeks.theta == pytest.approx(exact.greeks.theta, rel=2e-2)
    # Bumping r moves a Jarrow–Rudd tree's nodes relative to the strike, adding discretisation
    # noise to its rho; CRR and Leisen–Reimer keep the nodes fixed.
    rho_tolerance = 2e-2 if scheme == "jarrow-rudd" else 1e-2
    assert tree.greeks.rho == pytest.approx(exact.greeks.rho, rel=rho_tolerance)


def test_leisen_reimer_is_second_order(market, model):
    exact = AnalyticEngine().price(european(), market, model).value
    err_101 = abs(
        BinomialEngine(101, "leisen-reimer").price(european(), market, model).value - exact
    )
    err_401 = abs(
        BinomialEngine(401, "leisen-reimer").price(european(), market, model).value - exact
    )
    assert err_101 < 1e-4
    assert err_101 / err_401 > 12  # ~16 for O(1/N^2)


def test_leisen_reimer_uses_odd_steps(market, model):
    result = BinomialEngine(100, "leisen-reimer").price(european(), market, model)
    assert result.diagnostics["steps"] == 101


@pytest.mark.parametrize("scheme", SCHEMES)
def test_american_put_reference(scheme, market, model):
    # Widely quoted benchmark for S=K=100, T=1, r=5%, sigma=20%: about 6.090.
    value = BinomialEngine(2001, scheme).price(american("put"), market, model).value
    assert value == pytest.approx(6.0903, abs=1.5e-3)


@pytest.mark.parametrize("kind", ["call", "put"])
def test_american_at_least_european(kind, market, model):
    engine = BinomialEngine(300)
    assert (
        engine.price(american(kind), market, model).value
        >= engine.price(european(kind), market, model).value - 1e-12
    )


def test_american_call_without_dividends_equals_european(market, model):
    engine = BinomialEngine(300)
    assert engine.price(american("call"), market, model).value == pytest.approx(
        engine.price(european("call"), market, model).value, abs=1e-10
    )


def test_american_call_with_dividends_has_early_exercise_premium(model):
    market = Market(100, 0.05, 0.08)
    engine = BinomialEngine(300)
    assert (
        engine.price(american("call"), market, model).value
        > engine.price(european("call"), market, model).value + 1e-3
    )


def test_deep_itm_american_put_is_exercised(model):
    market = Market(40, 0.05)
    assert BinomialEngine(300).price(american("put"), market, model).value == pytest.approx(
        60, abs=1e-9
    )


def test_value_only_mode_matches(market, model):
    full = BinomialEngine(301).price(american(), market, model)
    fast = BinomialEngine(301, greeks=False).price(american(), market, model)
    assert fast.value == full.value and fast.greeks is None


def test_invalid_probability_raises(market, model):
    with pytest.raises(ValueError, match="probability"):
        BinomialEngine(3).price(european(expiry=10), replace(market, rate=0.5), model)


def test_tree_nodes_structure(market, model):
    tree, nodes = tree_nodes(american("put"), market, model, steps=4)
    assert len(nodes) == 15  # 1 + 2 + 3 + 4 + 5
    root = next(n for n in nodes if n.level == 0)
    assert root.spot == pytest.approx(100)
    assert root.value == pytest.approx(BinomialEngine(4).price(american(), market, model).value)
    # Early exercise happens only on the downside for a put.
    assert all(n.spot < 100 for n in nodes if n.exercised)
    assert 0 < tree.probability < 1


def test_tree_nodes_limits(market, model):
    with pytest.raises(ValueError):
        tree_nodes(european(), market, model, steps=13)


def test_leisen_reimer_degenerate_volatility_raises_value_error(market):
    with pytest.raises(ValueError, match="degenerate"):
        BinomialEngine(101, "leisen-reimer").price(
            american("put", strike=120), market, BlackScholes(1e-5)
        )
