import math
from dataclasses import replace

import pytest
from hypothesis import given
from hypothesis import strategies as st

from derivlab import AnalyticEngine, BlackScholes, Market, UnsupportedError
from tests.conftest import american, european

ENGINE = AnalyticEngine()


def test_reference_prices(market, model):
    # Hull-style textbook case: S=K=100, T=1, r=5%, sigma=20%.
    assert ENGINE.price(european("call"), market, model).value == pytest.approx(
        10.450583572185565, abs=1e-12
    )
    assert ENGINE.price(european("put"), market, model).value == pytest.approx(
        5.573526022256971, abs=1e-12
    )


@given(
    spot=st.floats(20, 300),
    strike=st.floats(20, 300),
    expiry=st.floats(0.01, 5),
    rate=st.floats(-0.02, 0.15),
    q=st.floats(0, 0.1),
    vol=st.floats(0.01, 1.5),
)
def test_put_call_parity(spot, strike, expiry, rate, q, vol):
    market = Market(spot, rate, q)
    model = BlackScholes(vol)
    call = ENGINE.price(european("call", strike, expiry), market, model).value
    put = ENGINE.price(european("put", strike, expiry), market, model).value
    forward_gap = spot * math.exp(-q * expiry) - strike * math.exp(-rate * expiry)
    assert call - put == pytest.approx(forward_gap, abs=1e-9 * max(spot, strike))


def test_expiry_and_zero_vol_limits(market, model):
    itm = replace(market, spot=120.0)
    assert ENGINE.price(european("call", expiry=0), itm, model).value == 20
    assert ENGINE.price(european("call"), market, BlackScholes(0)).value == pytest.approx(
        100 - 100 * math.exp(-0.05)
    )


@pytest.mark.parametrize("kind", ["call", "put"])
def test_greeks_match_finite_differences(kind, model):
    market = Market(100, 0.05, 0.02)
    option = european(kind)
    g = ENGINE.price(option, market, model).greeks
    assert g is not None
    h = 1e-3

    def v(mkt=market, mdl=model, opt=option):
        return ENGINE.price(opt, mkt, mdl).value

    assert g.delta == pytest.approx(
        (v(replace(market, spot=100 + h)) - v(replace(market, spot=100 - h))) / (2 * h), abs=1e-7
    )
    assert g.gamma == pytest.approx(
        (v(replace(market, spot=100 + h)) - 2 * v() + v(replace(market, spot=100 - h))) / h**2,
        abs=1e-5,
    )
    assert g.vega == pytest.approx(
        (v(mdl=BlackScholes(0.2 + h)) - v(mdl=BlackScholes(0.2 - h))) / (2 * h), rel=1e-5
    )
    assert g.rho == pytest.approx(
        (v(replace(market, rate=0.05 + h)) - v(replace(market, rate=0.05 - h))) / (2 * h), rel=1e-5
    )
    assert g.theta == pytest.approx(
        -(v(opt=european(kind, expiry=1 + h)) - v(opt=european(kind, expiry=1 - h))) / (2 * h),
        rel=1e-5,
    )


def test_american_is_unsupported(market, model):
    with pytest.raises(UnsupportedError):
        ENGINE.price(american(), market, model)
