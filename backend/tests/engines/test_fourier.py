import math

import numpy as np
import pytest

from derivlab import (
    SABR,
    AnalyticEngine,
    BlackScholes,
    CosEngine,
    Heston,
    Market,
    Merton,
    UnsupportedError,
)
from derivlab.engines.fourier import cos_prices, risk_neutral_density
from tests.conftest import american, european

MARKET = Market(100, 0.04, 0.01)
HESTON = Heston(0.04, 1.5, 0.06, 0.5, -0.7)


@pytest.mark.parametrize("kind", ["call", "put"])
@pytest.mark.parametrize("t", [0.02, 0.5, 3.0])
def test_matches_black_scholes(kind, t):
    strikes = np.array([70.0, 90, 100, 110, 140])
    cos = cos_prices(kind, strikes, t, MARKET, BlackScholes(0.25))
    exact = [
        AnalyticEngine().price(european(kind, k, t), MARKET, BlackScholes(0.25)).value
        for k in strikes
    ]
    assert np.allclose(cos, exact, atol=1e-10)


@pytest.mark.parametrize("kind", ["call", "put"])
def test_matches_merton_series(kind):
    model = Merton(0.2, 1.0, -0.1, 0.15)
    for strike in (80.0, 100.0, 125.0):
        option = european(kind, strike)
        assert CosEngine().price(option, MARKET, model).value == pytest.approx(
            AnalyticEngine().price(option, MARKET, model).value, abs=1e-8
        )


def test_heston_matches_quantlib():
    ql = pytest.importorskip("QuantLib")
    today = ql.Date(15, 10, 2026)
    ql.Settings.instance().evaluationDate = today
    dc = ql.Actual365Fixed()
    r = ql.YieldTermStructureHandle(ql.FlatForward(today, 0.04, dc))
    q = ql.YieldTermStructureHandle(ql.FlatForward(today, 0.01, dc))
    process = ql.HestonProcess(
        r, q, ql.QuoteHandle(ql.SimpleQuote(100)), 0.04, 1.5, 0.06, 0.5, -0.7
    )
    engine = ql.AnalyticHestonEngine(ql.HestonModel(process))
    for strike in (70.0, 100.0, 130.0):
        option = ql.EuropeanOption(
            ql.PlainVanillaPayoff(ql.Option.Call, strike), ql.EuropeanExercise(today + 365)
        )
        option.setPricingEngine(engine)
        ours = cos_prices("call", [strike], 1.0, MARKET, HESTON)[0]
        assert ours == pytest.approx(option.NPV(), abs=1e-7)


def test_put_call_parity_heston():
    strikes = np.linspace(60, 150, 10)
    calls = cos_prices("call", strikes, 0.75, MARKET, HESTON)
    puts = cos_prices("put", strikes, 0.75, MARKET, HESTON)
    gap = 100 * math.exp(-0.01 * 0.75) - strikes * math.exp(-0.04 * 0.75)
    assert np.allclose(calls - puts, gap, atol=1e-10)


def test_density_integrates_to_one_with_forward_mean():
    spots = np.linspace(1, 400, 4000)
    density = risk_neutral_density(HESTON, 1.0, MARKET, spots)
    ds = spots[1] - spots[0]
    assert density.sum() * ds == pytest.approx(1.0, abs=1e-3)
    assert (spots * density).sum() * ds == pytest.approx(MARKET.forward(1.0), rel=1e-3)


def test_unsupported_cases():
    with pytest.raises(UnsupportedError):
        CosEngine().price(european(), MARKET, SABR(0.2, 1.0, 0.0, 0.3))
    with pytest.raises(UnsupportedError):
        CosEngine().price(american(), MARKET, HESTON)
