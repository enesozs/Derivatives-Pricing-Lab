import pytest

from derivlab import AnalyticEngine, BinomialEngine, FiniteDifferenceEngine, Market
from derivlab.engines.pde import solve_pde
from tests.conftest import american, european


@pytest.mark.parametrize("kind", ["call", "put"])
def test_european_matches_black_scholes(kind, model):
    market = Market(100, 0.05, 0.02)
    exact = AnalyticEngine().price(european(kind, strike=105), market, model)
    pde = FiniteDifferenceEngine().price(european(kind, strike=105), market, model)
    assert pde.value == pytest.approx(exact.value, abs=1e-3)
    assert pde.greeks is not None and exact.greeks is not None
    for name, tol in [("delta", 1e-4), ("gamma", 1e-5), ("theta", 2e-3), ("vega", 5e-3)]:
        assert getattr(pde.greeks, name) == pytest.approx(getattr(exact.greeks, name), abs=tol)
    assert pde.greeks.rho == pytest.approx(exact.greeks.rho, rel=1e-3)


def test_second_order_convergence(market, model):
    exact = AnalyticEngine().price(european(), market, model).value
    errors = [
        abs(
            FiniteDifferenceEngine(n, n // 2, greeks=False).price(european(), market, model).value
            - exact
        )
        for n in (100, 200, 400)
    ]
    assert errors[0] / errors[1] > 3.5 and errors[1] / errors[2] > 3.5  # ~4 when halving h


def test_american_put_agrees_with_tree(market, model):
    pde = FiniteDifferenceEngine(800, 400, greeks=False).price(american("put"), market, model)
    tree = BinomialEngine(2001, "leisen-reimer", greeks=False).price(american("put"), market, model)
    assert pde.value == pytest.approx(tree.value, abs=1e-3)


def test_american_never_below_payoff(model):
    market = Market(70, 0.05)
    _, values, _, _, _ = solve_pde(american("put"), market, model)
    assert values[len(values) // 2] >= 30 - 1e-9


def test_grid_is_kept_for_visualisation(market, model):
    *_, grid = solve_pde(american("put"), market, model, 100, 50, keep_grid=True)
    assert grid is not None
    assert grid.values.shape == (len(grid.taus), len(grid.spots))
    assert grid.exercised.any()  # an American put has an exercise region


def test_far_strike_stays_inside_grid(model):
    market = Market(100, 0.05)
    exact = AnalyticEngine().price(european("put", strike=250), market, model).value
    assert FiniteDifferenceEngine().price(
        european("put", strike=250), market, model
    ).value == pytest.approx(exact, abs=1e-2)
