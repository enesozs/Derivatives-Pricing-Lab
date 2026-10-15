"""No-arbitrage properties every correct pricer must satisfy, checked on random inputs."""

from hypothesis import given, settings
from hypothesis import strategies as st

from derivlab import AnalyticEngine, BinomialEngine, BlackScholes, Market
from derivlab.calibration import price_bounds
from tests.conftest import american, european

ENGINE = AnalyticEngine()
markets = st.builds(Market, st.floats(50, 150), st.floats(0, 0.1), st.floats(0, 0.06))
vols = st.floats(0.05, 0.8)
kinds = st.sampled_from(["call", "put"])
expiries = st.floats(0.05, 3)


@given(markets, vols, kinds, expiries, st.floats(50, 150))
def test_within_no_arbitrage_bounds(market, vol, kind, t, strike):
    option = european(kind, strike, t)
    low, high = price_bounds(option, market)
    value = ENGINE.price(option, market, BlackScholes(vol)).value
    assert low - 1e-9 <= value <= high + 1e-9


@given(markets, vols, expiries, st.floats(60, 140), st.floats(0.5, 10))
def test_monotone_in_strike(market, vol, t, k, dk):
    model = BlackScholes(vol)
    call_low = ENGINE.price(european("call", k, t), market, model).value
    call_high = ENGINE.price(european("call", k + dk, t), market, model).value
    put_low = ENGINE.price(european("put", k, t), market, model).value
    put_high = ENGINE.price(european("put", k + dk, t), market, model).value
    assert call_high <= call_low + 1e-9
    assert put_high >= put_low - 1e-9
    # A call can't lose more than the discounted strike difference.
    assert call_low - call_high <= dk * market.discount(t) + 1e-9


@given(markets, kinds, expiries, st.floats(60, 140), st.floats(0.05, 0.6), st.floats(0.01, 0.3))
def test_increasing_in_volatility(market, kind, t, k, vol, dvol):
    option = european(kind, k, t)
    low = ENGINE.price(option, market, BlackScholes(vol)).value
    high = ENGINE.price(option, market, BlackScholes(vol + dvol)).value
    assert high >= low - 1e-9


@given(markets, vols, kinds, expiries, st.floats(60, 140), st.floats(1, 20))
def test_convex_in_strike(market, vol, kind, t, k, dk):
    model = BlackScholes(vol)

    def value(strike: float) -> float:
        return ENGINE.price(european(kind, strike, t), market, model).value

    # Butterfly spread value must be non-negative.
    assert value(k - dk) - 2 * value(k) + value(k + dk) >= -1e-9


@settings(max_examples=25, deadline=None)
@given(markets, vols, kinds, st.floats(0.1, 2), st.floats(70, 130))
def test_american_worth_at_least_european_and_payoff(market, vol, kind, t, k):
    model = BlackScholes(vol)
    engine = BinomialEngine(201, "leisen-reimer", greeks=False)
    am = engine.price(american(kind, k, t), market, model).value
    eu = engine.price(european(kind, k, t), market, model).value
    assert am >= eu - 1e-9
    assert am >= float(american(kind, k, t).payoff(market.spot)) - 1e-9
