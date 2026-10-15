"""Exotic options: closed forms vs QuantLib, Monte Carlo and PDE vs closed forms, parities."""

import numpy as np
import pytest

from derivlab import (
    AnalyticEngine,
    AsianOption,
    BarrierOption,
    BlackScholes,
    CosEngine,
    DigitalOption,
    FiniteDifferenceEngine,
    Heston,
    LocalVol,
    LookbackOption,
    Market,
    MonteCarloEngine,
    UnsupportedError,
)
from tests.conftest import european

MARKET = Market(100, 0.05, 0.02)
MODEL = BlackScholes(0.25)
EXACT = AnalyticEngine()

BARRIERS = [
    BarrierOption(kind, strike, 1.0, barrier, direction, knock)  # type: ignore[arg-type]
    for kind in ("call", "put")
    for strike in (90.0, 110.0)
    for barrier, direction in ((80.0, "down"), (95.0, "down"), (105.0, "up"), (125.0, "up"))
    for knock in ("in", "out")
]


@pytest.fixture(scope="module")
def ql_process():
    ql = pytest.importorskip("QuantLib")
    today = ql.Date(15, 10, 2026)
    ql.Settings.instance().evaluationDate = today
    dc = ql.Actual365Fixed()
    process = ql.BlackScholesMertonProcess(
        ql.QuoteHandle(ql.SimpleQuote(100.0)),
        ql.YieldTermStructureHandle(ql.FlatForward(today, 0.02, dc)),
        ql.YieldTermStructureHandle(ql.FlatForward(today, 0.05, dc)),
        ql.BlackVolTermStructureHandle(ql.BlackConstantVol(today, ql.NullCalendar(), 0.25, dc)),
    )
    return ql, today, process


@pytest.mark.parametrize(
    "option", BARRIERS, ids=lambda o: f"{o.label}-K{o.strike:.0f}-H{o.barrier:.0f}"
)
def test_barrier_closed_form_matches_quantlib(option, ql_process):
    ql, today, process = ql_process
    kinds = {"call": ql.Option.Call, "put": ql.Option.Put}
    types = {
        ("down", "in"): ql.Barrier.DownIn,
        ("up", "in"): ql.Barrier.UpIn,
        ("down", "out"): ql.Barrier.DownOut,
        ("up", "out"): ql.Barrier.UpOut,
    }
    ql_option = ql.BarrierOption(
        types[(option.direction, option.knock)],
        option.barrier,
        0.0,
        ql.PlainVanillaPayoff(kinds[option.kind], option.strike),
        ql.EuropeanExercise(today + 365),
    )
    ql_option.setPricingEngine(ql.AnalyticBarrierEngine(process))
    assert EXACT.price(option, MARKET, MODEL).value == pytest.approx(ql_option.NPV(), abs=1e-10)


@pytest.mark.parametrize("option", BARRIERS[::3], ids=lambda o: f"{o.label}-H{o.barrier:.0f}")
def test_in_out_parity(option):
    other = BarrierOption(
        option.kind,
        option.strike,
        1.0,
        option.barrier,
        option.direction,
        "out" if option.knock == "in" else "in",
    )
    vanilla = EXACT.price(european(option.kind, option.strike), MARKET, MODEL).value
    total = EXACT.price(option, MARKET, MODEL).value + EXACT.price(other, MARKET, MODEL).value
    assert total == pytest.approx(vanilla, abs=1e-10)


@pytest.mark.parametrize(
    "option", BARRIERS[::2], ids=lambda o: f"{o.label}-K{o.strike:.0f}-H{o.barrier:.0f}"
)
def test_pde_barriers(option):
    exact = EXACT.price(option, MARKET, MODEL).value
    assert FiniteDifferenceEngine(greeks=False).price(option, MARKET, MODEL).value == pytest.approx(
        exact, abs=2e-3
    )


@pytest.mark.parametrize(
    "option",
    [
        BarrierOption("call", 100, 1.0, 85, "down", "out"),
        BarrierOption("put", 100, 1.0, 115, "up", "in"),
    ],
    ids=["down-out-call", "up-in-put"],
)
def test_monte_carlo_continuous_barrier_with_brownian_bridge(option):
    exact = EXACT.price(option, MARKET, MODEL).value
    mc = MonteCarloEngine(paths=40_000, seed=5).price(option, MARKET, MODEL)
    assert mc.stderr is not None and abs(mc.value - exact) < 4 * mc.stderr


def test_discrete_monitoring_is_cheaper_to_knock_out():
    continuous = BarrierOption("call", 100, 1.0, 85, "down", "out")
    monthly = BarrierOption("call", 100, 1.0, 85, "down", "out", observations=12)
    mc = MonteCarloEngine(paths=40_000).price(monthly, MARKET, MODEL)
    assert mc.value > EXACT.price(continuous, MARKET, MODEL).value  # fewer checks, fewer knock-outs
    # The BGK-corrected closed form approximates the discrete price.
    assert EXACT.price(monthly, MARKET, MODEL).value == pytest.approx(mc.value, rel=0.01)


@pytest.mark.parametrize("payout", ["cash", "asset"])
def test_digitals(payout, ql_process):
    ql, today, process = ql_process
    for kind, ql_kind in (("call", ql.Option.Call), ("put", ql.Option.Put)):
        option = DigitalOption(kind, 105.0, 1.0, payout)  # type: ignore[arg-type]
        payoff = (
            ql.CashOrNothingPayoff(ql_kind, 105.0, 1.0)
            if payout == "cash"
            else ql.AssetOrNothingPayoff(ql_kind, 105.0)
        )
        ql_option = ql.VanillaOption(payoff, ql.EuropeanExercise(today + 365))
        ql_option.setPricingEngine(ql.AnalyticEuropeanEngine(process))
        assert EXACT.price(option, MARKET, MODEL).value == pytest.approx(ql_option.NPV(), abs=1e-10)
        mc = MonteCarloEngine(paths=40_000).price(option, MARKET, MODEL)
        assert mc.stderr is not None and abs(mc.value - ql_option.NPV()) < 4 * mc.stderr


def test_cash_digital_call_plus_put_is_a_bond():
    call = EXACT.price(DigitalOption("call", 100, 1.0), MARKET, MODEL).value
    put = EXACT.price(DigitalOption("put", 100, 1.0), MARKET, MODEL).value
    assert call + put == pytest.approx(MARKET.discount(1.0))


def test_geometric_asian_matches_quantlib(ql_process):
    ql, today, process = ql_process
    dates = [today + 30 * (i + 1) for i in range(12)]
    option = AsianOption("call", 100.0, 360 / 365, 12, "geometric")
    ql_option = ql.DiscreteAveragingAsianOption(
        ql.Average.Geometric,
        1.0,
        0,
        dates,
        ql.PlainVanillaPayoff(ql.Option.Call, 100.0),
        ql.EuropeanExercise(dates[-1]),
    )
    ql_option.setPricingEngine(ql.AnalyticDiscreteGeometricAveragePriceAsianEngine(process))
    assert EXACT.price(option, MARKET, MODEL).value == pytest.approx(ql_option.NPV(), abs=1e-10)


def test_arithmetic_asian_control_variate():
    option = AsianOption("call", 100.0, 1.0, 12)
    plain = MonteCarloEngine(paths=40_000, control_variate=False).price(option, MARKET, MODEL)
    controlled = MonteCarloEngine(paths=40_000).price(option, MARKET, MODEL)
    assert plain.stderr is not None and controlled.stderr is not None
    assert controlled.stderr < plain.stderr / 8
    assert abs(controlled.value - plain.value) < 4 * plain.stderr
    # Arithmetic average >= geometric average, so the arithmetic call is worth more.
    geometric = EXACT.price(AsianOption("call", 100.0, 1.0, 12, "geometric"), MARKET, MODEL).value
    assert controlled.value > geometric
    # Averaging reduces volatility: cheaper than the vanilla.
    assert controlled.value < EXACT.price(european("call"), MARKET, MODEL).value


@pytest.mark.parametrize(
    "option",
    [
        LookbackOption("call", 1.0, "floating"),
        LookbackOption("put", 1.0, "floating"),
        LookbackOption("call", 1.0, "fixed", 110.0),
        LookbackOption("put", 1.0, "fixed", 90.0),
    ],
    ids=["float-call", "float-put", "fixed-call", "fixed-put"],
)
def test_lookbacks(option, ql_process):
    ql, today, process = ql_process
    kind = ql.Option.Call if option.kind == "call" else ql.Option.Put
    exercise = ql.EuropeanExercise(today + 365)
    if option.strike_type == "floating":
        ql_option = ql.ContinuousFloatingLookbackOption(
            100.0, ql.FloatingTypePayoff(kind), exercise
        )
        ql_option.setPricingEngine(ql.AnalyticContinuousFloatingLookbackEngine(process))
    else:
        ql_option = ql.ContinuousFixedLookbackOption(
            100.0, ql.PlainVanillaPayoff(kind, option.strike), exercise
        )
        ql_option.setPricingEngine(ql.AnalyticContinuousFixedLookbackEngine(process))
    assert EXACT.price(option, MARKET, MODEL).value == pytest.approx(ql_option.NPV(), abs=1e-9)
    mc = MonteCarloEngine(paths=30_000).price(option, MARKET, MODEL)
    assert mc.stderr is not None and abs(mc.value - ql_option.NPV()) < 4 * mc.stderr


def test_exotics_under_other_models():
    heston = Heston(0.0625, 1.5, 0.0625, 0.5, -0.7)
    option = BarrierOption("call", 100, 1.0, 85, "down", "out", observations=52)
    mc = MonteCarloEngine(paths=20_000).price(option, MARKET, heston)
    vanilla = CosEngine().price(european("call"), MARKET, heston).value
    assert 0 < mc.value < vanilla
    lv = MonteCarloEngine(paths=20_000).price(
        LookbackOption("call", 0.5), MARKET, LocalVol.constant(0.25)
    )
    exact = EXACT.price(LookbackOption("call", 0.5), MARKET, MODEL).value
    assert lv.stderr is not None and abs(lv.value - exact) < 4 * lv.stderr


def test_unsupported_combinations():
    with pytest.raises(UnsupportedError):
        EXACT.price(AsianOption("call", 100, 1.0), MARKET, MODEL)  # arithmetic: no closed form
    with pytest.raises(UnsupportedError):
        EXACT.price(
            BarrierOption("call", 100, 1.0, 85, "down", "out"),
            MARKET,
            Heston(0.04, 1, 0.04, 0.3, -0.5),
        )
    with pytest.raises(UnsupportedError):
        FiniteDifferenceEngine().price(LookbackOption("call", 1.0), MARKET, MODEL)


def test_already_breached_barrier():
    vanilla = EXACT.price(european("put", 100), MARKET, MODEL).value
    knocked_in = BarrierOption("put", 100, 1.0, 105, "up", "in")
    knocked_out = BarrierOption("put", 100, 1.0, 105, "up", "out")
    assert EXACT.price(knocked_in, Market(110, 0.05, 0.02), MODEL).value == pytest.approx(
        EXACT.price(european("put", 100), Market(110, 0.05, 0.02), MODEL).value
    )
    assert EXACT.price(knocked_out, Market(110, 0.05, 0.02), MODEL).value == 0.0
    assert vanilla > 0


@pytest.mark.parametrize(
    "bad", [dict(barrier=-1), dict(direction="sideways"), dict(observations=0)]
)
def test_invalid_barrier(bad):
    args = (
        dict(kind="call", strike=100.0, expiry=1.0, barrier=90.0, direction="down", knock="out")
        | bad
    )
    with pytest.raises(ValueError):
        BarrierOption(**args)  # type: ignore[arg-type]


def test_payoff_paths_shapes():
    paths = np.array([[100.0, 90.0, 120.0], [100.0, 110.0, 80.0]])
    times = np.array([0.0, 0.5, 1.0])
    out = BarrierOption("call", 100, 1.0, 95, "down", "out")
    assert out.payoff_paths(paths, times).tolist() == [0.0, 0.0]
    look = LookbackOption("call", 1.0)
    assert look.payoff_paths(paths, times).tolist() == [30.0, 0.0]
