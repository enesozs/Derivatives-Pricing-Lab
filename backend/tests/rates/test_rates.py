import math

import numpy as np
import pytest

from derivlab.rates import (
    SAMPLE_QUOTES,
    CapFloor,
    DiscountCurve,
    FixedRateBond,
    InterestRateSwap,
    Quote,
    Swaption,
    bachelier,
    black,
    bootstrap,
    implied_vol,
    repricing_errors,
)
from derivlab.rates.short_rate import HullWhite, Vasicek, calibrate_hull_white_to_caps
from derivlab.rates.tree import bermudan_swaption, build_tree

FLAT = DiscountCurve.flat(0.04)


@pytest.fixture(scope="module")
def curve():
    return bootstrap(SAMPLE_QUOTES)


# --- curves -------------------------------------------------------------------------------------


def test_bootstrap_reprices_every_quote(curve):
    assert max(abs(e) for e in repricing_errors(curve, SAMPLE_QUOTES)) < 1e-12


def test_bootstrap_with_fra():
    quotes = [*SAMPLE_QUOTES[:3], Quote("fra", 0.75, 0.04, start=0.5), *SAMPLE_QUOTES[3:]]
    assert max(abs(e) for e in repricing_errors(bootstrap(quotes), quotes)) < 1e-12


def test_curve_identities(curve):
    t = np.array([0.5, 2.0, 7.0, 25.0])
    assert np.allclose(curve.discount(t), np.exp(-curve.zero_rate(t) * t))
    assert float(curve.forward_rate(1.0, 2.0)) == pytest.approx(
        (curve.df(1) / curve.df(2) - 1) / 1.0
    )
    # Flat extrapolation keeps discount factors positive and decreasing.
    far = curve.discount(np.array([30.0, 40.0, 60.0]))
    assert np.all(np.diff(far) < 0) and np.all(far > 0)


def test_flat_curve_and_shift():
    assert FLAT.zero_rate(7.0) == pytest.approx(0.04)
    assert FLAT.shifted(100).zero_rate(7.0) == pytest.approx(0.05)


@pytest.mark.parametrize(
    "bad", [([1.0, 1.0], [0.9, 0.8]), ([1.0], [-0.1]), ([2.0, 1.0], [0.9, 0.95])]
)
def test_invalid_curves(bad):
    with pytest.raises(ValueError):
        DiscountCurve(tuple(bad[0]), tuple(bad[1]))


# --- bonds and swaps ----------------------------------------------------------------------------


def test_swap_at_par_rate_is_worth_zero(curve):
    for maturity in (2, 5, 10):
        par = InterestRateSwap(0.0, maturity).par_rate(curve)
        assert InterestRateSwap(par, maturity).npv(curve) == pytest.approx(0, abs=1e-6)
        quote = next(q for q in SAMPLE_QUOTES if q.maturity == maturity)
        assert par == pytest.approx(quote.rate, abs=1e-12)


def test_payer_loses_when_rates_fall(curve):
    swap = InterestRateSwap(0.037, 5)
    assert swap.dv01(curve) < 0 and InterestRateSwap(0.037, 5, payer=False).dv01(curve) > 0
    assert swap.dv01(curve) == pytest.approx(
        -swap.notional * swap.annuity(curve) / 10_000,
        rel=0.06,  # a parallel zero shift moves the par rate a bit more than 1bp
    )


def test_bond_yield_round_trip_and_risk():
    bond = FixedRateBond(0.05, 10, 2)
    y = bond.yield_to_maturity(bond.price(FLAT))
    assert bond.price_from_yield(y) == pytest.approx(bond.price(FLAT), abs=1e-9)
    risk = bond.risk(y)
    # Duration and convexity predict a 50bp move to second order.
    dy = 0.005
    approx = risk["price"] * (1 - risk["modified_duration"] * dy + 0.5 * risk["convexity"] * dy**2)
    assert bond.price_from_yield(y + dy) == pytest.approx(approx, rel=1e-4)
    # A par bond (coupon = yield) prices at face.
    assert FixedRateBond(0.04, 10, 2).price_from_yield(0.04) == pytest.approx(100.0)


# --- Black and Bachelier ---------------------------------------------------------------------


@pytest.mark.parametrize("model", ["black", "bachelier"])
def test_vol_round_trip_and_parity(model):
    vol = 0.25 if model == "black" else 0.009
    fn = black if model == "black" else bachelier
    call, put = fn(0.04, 0.035, 2.0, vol, True), fn(0.04, 0.035, 2.0, vol, False)
    assert call - put == pytest.approx(0.04 - 0.035)
    assert implied_vol(model, call, 0.04, 0.035, 2.0, True) == pytest.approx(vol, rel=1e-10)


def test_bachelier_handles_negative_rates():
    assert bachelier(-0.002, 0.0, 1.0, 0.005, True) > 0
    with pytest.raises(ValueError):
        black(-0.002, 0.001, 1.0, 0.3, True)


def test_swaption_parity_and_cap_floor_parity(curve):
    payer = Swaption(1, 5, 0.037).price(curve, 0.2)
    receiver = Swaption(1, 5, 0.037, payer=False).price(curve, 0.2)
    assert payer - receiver == pytest.approx(
        InterestRateSwap(0.037, 5, start=1).npv(curve), rel=1e-9
    )
    cap = CapFloor(0.04, 5).price(curve, 0.2)
    floor = CapFloor(0.04, 5, cap=False).price(curve, 0.2)
    # Cap - floor = swap from the first fixing on (first period excluded by convention).
    times = np.arange(0.25, 5.0001, 0.25)
    swap = sum(
        1_000_000 * 0.25 * curve.df(t) * (float(curve.forward_rate(t - 0.25, t)) - 0.04)
        for t in times[1:]
    )
    assert cap - floor == pytest.approx(swap, rel=1e-9)


# --- short-rate models --------------------------------------------------------------------------


@pytest.fixture(scope="module")
def ql():
    return pytest.importorskip("QuantLib")


def test_vasicek_matches_quantlib(ql):
    ours = Vasicek(0.1, 0.05, 0.01, 0.03)
    theirs = ql.Vasicek(0.03, 0.1, 0.05, 0.01)
    assert float(ours.discount(5.0)) == pytest.approx(theirs.discountBond(0, 5.0, 0.03), abs=1e-14)
    assert ours.bond_option(1, 5, 0.85, True) == pytest.approx(
        theirs.discountBondOption(ql.Option.Call, 0.85, 1.0, 5.0), abs=1e-12
    )


def test_hull_white_bond_option_matches_quantlib(ql):
    today = ql.Date(15, 10, 2026)
    ql.Settings.instance().evaluationDate = today
    ts = ql.YieldTermStructureHandle(
        ql.FlatForward(today, 0.04, ql.Actual365Fixed(), ql.Continuous)
    )
    theirs = ql.HullWhite(ts, 0.05, 0.01)
    ours = HullWhite(0.05, 0.01, FLAT)
    for call, kind in ((True, ql.Option.Call), (False, ql.Option.Put)):
        assert ours.bond_option(1, 5, 0.85, call) == pytest.approx(
            theirs.discountBondOption(kind, 0.85, 1.0, 5.0), abs=1e-12
        )


def test_hull_white_fits_the_curve(curve):
    model = HullWhite(0.05, 0.01, curve)
    assert float(model.bond_price(0.0, 7.0, float(curve.zero_rate(1e-4)))) == pytest.approx(
        curve.df(7.0), rel=1e-4
    )
    paths = model.simulate(5.0, 120, 20_000)
    simulated = np.mean(np.exp(-np.trapezoid(paths, dx=5.0 / 120, axis=1)))
    assert simulated == pytest.approx(curve.df(5.0), rel=2e-3)


def test_hull_white_cap_close_to_black_at_matching_vol():
    model = HullWhite(0.05, 0.01, FLAT)
    cap = CapFloor(0.04, 5, 4, 1.0)
    hw = model.cap_price(cap)
    vol = 0.01 / 0.04  # normal vol / rate ~ lognormal vol
    assert hw == pytest.approx(cap.price(FLAT, vol), rel=0.15)


def test_tree_reprices_curve_and_matches_jamshidian(curve):
    tree = build_tree(0.05, 0.01, curve, 10.0, 120)
    values = np.ones(2 * tree.width(120) + 1)
    for m in range(119, -1, -1):
        values = tree.rollback(m, values)
    assert values[0] == pytest.approx(curve.df(10.0), rel=1e-12)
    swaption = Swaption(2, 5, 0.04)
    exact = HullWhite(0.05, 0.01, FLAT).swaption_price(swaption)
    tree_value = bermudan_swaption(swaption, 0.05, 0.01, FLAT, steps_per_period=96, bermudan=False)
    assert tree_value == pytest.approx(exact, rel=1e-3)


def test_bermudan_worth_more_than_european():
    swaption = Swaption(2, 5, 0.04)
    european = bermudan_swaption(swaption, 0.05, 0.01, FLAT, bermudan=False)
    bermudan = bermudan_swaption(swaption, 0.05, 0.01, FLAT)
    assert bermudan > european


def test_bermudan_swaption_matches_quantlib(ql, curve):
    """Bootstrapped curve, ATM 2Y-into-5Y payer, exercisable on every fixed-leg reset."""
    today = ql.Date(15, 10, 2026)
    ql.Settings.instance().evaluationDate = today
    dc = ql.Actual365Fixed()
    times = np.linspace(0.01, 30, 3000)
    dates = [today] + [today + round(t * 365) for t in times]
    handle = ql.YieldTermStructureHandle(
        ql.DiscountCurve(dates, [1.0, *curve.discount(times).tolist()], dc)
    )
    strike = Swaption(2, 5, 0.0).forward_swap_rate(curve)
    schedule = ql.Schedule([today + 365 * k for k in range(2, 8)])
    index = ql.IborIndex(
        "x",
        ql.Period(1, ql.Years),
        0,
        ql.USDCurrency(),
        ql.NullCalendar(),
        ql.Unadjusted,
        False,
        dc,
        handle,
    )
    swap = ql.VanillaSwap(ql.Swap.Payer, 1.0, schedule, strike, dc, schedule, index, 0.0, dc)
    theirs = ql.Swaption(swap, ql.BermudanExercise(list(schedule)[:-1]))
    theirs.setPricingEngine(ql.TreeSwaptionEngine(ql.HullWhite(handle, 0.05, 0.01), 600))
    ours = bermudan_swaption(Swaption(2, 5, strike), 0.05, 0.01, curve, steps_per_period=96)
    assert ours == pytest.approx(theirs.NPV() * 1_000_000, rel=1e-3)


def test_hull_white_calibration_to_caps(curve):
    fit = calibrate_hull_white_to_caps(
        curve, [1, 2, 3, 5, 7, 10], [0.30, 0.28, 0.26, 0.24, 0.22, 0.21]
    )
    assert fit.rmse < 0.02
    assert 0 < fit.model.a < 2 and 0 < fit.model.sigma < 0.1
    assert math.isfinite(fit.model_vols[0])
