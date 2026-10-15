"""Every engine/model combination agrees with an independent method, or refuses clearly."""

import pytest

from derivlab import (
    SABR,
    AnalyticEngine,
    BinomialEngine,
    BlackScholes,
    CosEngine,
    FiniteDifferenceEngine,
    Heston,
    LocalVol,
    Market,
    Merton,
    MonteCarloEngine,
    UnsupportedError,
)
from tests.conftest import american, european

MARKET = Market(100, 0.04, 0.01)


@pytest.mark.parametrize(
    "model",
    [Heston(0.04, 1.5, 0.06, 0.5, -0.7), Merton(0.2, 1.0, -0.1, 0.15)],
    ids=["heston", "merton"],
)
@pytest.mark.parametrize("strike", [85.0, 100.0, 115.0])
def test_monte_carlo_agrees_with_fourier(model, strike):
    option = european("call", strike)
    exact = CosEngine().price(option, MARKET, model).value
    mc = MonteCarloEngine(paths=60_000, seed=3, steps_per_year=200).price(option, MARKET, model)
    assert mc.stderr is not None
    # Heston uses an Euler scheme with O(dt) bias; allow it on top of the statistical error.
    assert abs(mc.value - exact) < 4 * mc.stderr + 0.02


def test_merton_without_jumps_is_black_scholes():
    option = european("put", 95.0)
    assert AnalyticEngine().price(
        option, MARKET, Merton(0.2, 0.0, -0.1, 0.1)
    ).value == pytest.approx(AnalyticEngine().price(option, MARKET, BlackScholes(0.2)).value)


def test_sabr_analytic_uses_hagan_vol():
    model = SABR(0.2, 1.0, -0.4, 0.5)
    result = AnalyticEngine().price(european("call", 110.0), MARKET, model)
    assert result.diagnostics["implied_vol"] == pytest.approx(
        float(model.implied_volatility(MARKET.forward(1.0), 110.0, 1.0))
    )


@pytest.mark.parametrize("kind", ["call", "put"])
def test_flat_local_vol_equals_black_scholes(kind):
    option = european(kind, 110.0)
    exact = AnalyticEngine().price(option, MARKET, BlackScholes(0.25)).value
    assert FiniteDifferenceEngine().price(
        option, MARKET, LocalVol.constant(0.25)
    ).value == pytest.approx(exact, abs=5e-4)
    mc = MonteCarloEngine(paths=40_000).price(option, MARKET, LocalVol.constant(0.25))
    assert mc.stderr is not None and abs(mc.value - exact) < 4 * mc.stderr


def test_american_put_under_flat_local_vol():
    value = (
        FiniteDifferenceEngine()
        .price(american("put"), Market(100, 0.05), LocalVol.constant(0.2))
        .value
    )
    assert value == pytest.approx(6.0903, abs=2e-3)


@pytest.mark.parametrize(
    "engine,model",
    [
        (BinomialEngine(), Heston(0.04, 1.5, 0.06, 0.5, -0.7)),
        (FiniteDifferenceEngine(), Merton(0.2, 1.0, -0.1, 0.15)),
        (AnalyticEngine(), Heston(0.04, 1.5, 0.06, 0.5, -0.7)),
        (AnalyticEngine(), LocalVol.constant(0.2)),
    ],
)
def test_unsupported_combinations_refuse(engine, model):
    with pytest.raises(UnsupportedError):
        engine.price(european(), MARKET, model)
