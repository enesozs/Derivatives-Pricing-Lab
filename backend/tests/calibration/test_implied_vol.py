import pytest
from hypothesis import assume, given
from hypothesis import strategies as st

from derivlab import AnalyticEngine, BlackScholes, CRREngine, Market
from derivlab.calibration import implied_volatility, price_bounds
from tests.conftest import american, european


@given(
    kind=st.sampled_from(["call", "put"]),
    strike=st.floats(60, 160),
    expiry=st.floats(0.05, 3),
    vol=st.floats(0.05, 1.2),
    q=st.floats(0, 0.06),
)
def test_round_trip_european(kind, strike, expiry, vol, q):
    market = Market(100, 0.03, q)
    option = european(kind, strike, expiry)
    result = AnalyticEngine().price(option, market, BlackScholes(vol))
    price = result.value
    # When the price barely moves with volatility (deep in or out of the money, short expiry),
    # volatility is not recoverable from it; the solver rightly refuses those cases.
    assume(result.greeks is not None and result.greeks.vega > 1e-2)
    result = implied_volatility(price, option, market)
    assert result.volatility == pytest.approx(vol, abs=1e-6)
    assert abs(result.residual) < 1e-8


def test_round_trip_american_with_tree(market):
    engine = CRREngine(300)
    option = american("put")
    price = engine.price(option, market, BlackScholes(0.3)).value
    result = implied_volatility(price, option, market, engine)
    assert result.volatility == pytest.approx(0.3, abs=1e-6)


@pytest.mark.parametrize("price", [-1.0, 0.0, 100.0, 150.0])
def test_prices_outside_bounds_raise(price, market):
    with pytest.raises(ValueError):
        implied_volatility(price, european("call"), market)


def test_bounds(market):
    low, high = price_bounds(european("call"), market)
    assert low == pytest.approx(100 - 100 * 2.718281828459045**-0.05)
    assert high == 100
    low, high = price_bounds(american("put", strike=120), market)
    assert low == 20 and high == 120


def test_deep_itm_american_put_at_intrinsic_is_not_identifiable(market):
    with pytest.raises(ValueError, match="not identifiable"):
        implied_volatility(60.0, american("put", strike=160), market, CRREngine(200))
