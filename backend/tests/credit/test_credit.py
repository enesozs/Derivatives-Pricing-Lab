import math

import numpy as np
import pytest

from derivlab.credit import (
    CDS,
    SAMPLE_CDS_QUOTES,
    CDSQuote,
    HazardCurve,
    bootstrap_hazard,
    credit_adjustments,
    repricing_errors,
    swap_exposure,
)
from derivlab.rates import DiscountCurve, HullWhite, InterestRateSwap, Swaption

CURVE = DiscountCurve.flat(0.03)


def test_survival_and_default_probabilities():
    h = HazardCurve((1.0, 3.0), (0.01, 0.03))
    assert float(h.survival(0.5)) == pytest.approx(math.exp(-0.005))
    assert float(h.survival(2.0)) == pytest.approx(math.exp(-0.01 - 0.03))
    assert float(h.survival(5.0)) == pytest.approx(math.exp(-0.01 - 0.06 - 0.06))  # flat beyond
    assert float(h.default_probability(1.0, 2.0)) == pytest.approx(
        math.exp(-0.01) - math.exp(-0.04)
    )
    with pytest.raises(ValueError):
        HazardCurve((1.0,), (-0.01,))


def test_credit_triangle():
    """Flat hazard: par spread ~ lambda (1 - R)."""
    spread = CDS(5, 0.0, recovery=0.4).par_spread(CURVE, HazardCurve.flat(0.02))
    assert spread == pytest.approx(0.02 * 0.6, rel=0.01)


def test_bootstrap_reprices_quotes_and_rejects_impossible_curves():
    hazard = bootstrap_hazard(SAMPLE_CDS_QUOTES, CURVE)
    assert max(abs(e) for e in repricing_errors(SAMPLE_CDS_QUOTES, CURVE, hazard)) < 1e-12
    assert all(h > 0 for h in hazard.hazards)
    with pytest.raises(ValueError, match="negative hazard"):
        bootstrap_hazard([CDSQuote(1, 0.03), CDSQuote(5, 0.001)], CURVE)


def test_par_cds_is_worth_zero_and_upfront():
    hazard = bootstrap_hazard(SAMPLE_CDS_QUOTES, CURVE)
    par = CDS(5, 0.0).par_spread(CURVE, hazard)
    assert CDS(5, par).npv(CURVE, hazard) == pytest.approx(0.0, abs=1e-15)
    assert CDS(5, par).upfront(CURVE, hazard, par) == pytest.approx(0.0, abs=1e-15)
    # Paying a 100bp coupon on a ~115bp name: the buyer pays a small upfront.
    upfront = CDS(5, par).upfront(CURVE, hazard, 0.01)
    assert 0 < upfront < 0.01
    # Seller's NPV is the mirror image.
    assert CDS(5, 0.01, buyer=False).npv(CURVE, hazard) == pytest.approx(
        -CDS(5, 0.01).npv(CURVE, hazard)
    )


def test_cds_matches_quantlib_midpoint_engine():
    ql = pytest.importorskip("QuantLib")
    today = ql.Date(15, 10, 2026)
    ql.Settings.instance().evaluationDate = today
    dc = ql.Actual365Fixed()
    discount = ql.YieldTermStructureHandle(ql.FlatForward(today, 0.03, dc, ql.Continuous))
    hazard = ql.DefaultProbabilityTermStructureHandle(
        ql.FlatHazardRate(today, ql.QuoteHandle(ql.SimpleQuote(0.02)), dc)
    )
    schedule = ql.Schedule([today + round(0.25 * i * 365) for i in range(21)])
    theirs = ql.CreditDefaultSwap(
        ql.Protection.Buyer, 1.0, 0.01, schedule, ql.Unadjusted, dc, True, True, today
    )
    theirs.setPricingEngine(ql.MidPointCdsEngine(hazard, 0.4, discount))
    ours = CDS(5, 0.01, 0.4)
    # Residual differences come from rounding quarter-years to whole days in QuantLib's dates.
    assert ours.par_spread(CURVE, HazardCurve.flat(0.02)) == pytest.approx(
        theirs.fairSpread(), rel=1e-4
    )
    assert ours.legs(CURVE, HazardCurve.flat(0.02))["protection"] == pytest.approx(
        theirs.defaultLegNPV(), rel=1e-4
    )


# --- exposure and CVA ----------------------------------------------------------------------------


@pytest.fixture(scope="module")
def setup():
    model = HullWhite(0.05, 0.01, CURVE)
    strike = InterestRateSwap(0.0, 5).par_rate(CURVE)
    payer = InterestRateSwap(strike, 5, 1, 1.0, True)
    return model, strike, payer, swap_exposure(payer, model, paths=20_000)


def test_expected_exposure_at_resets_is_a_swaption(setup):
    model, strike, _, profile = setup
    for year in (1, 2, 3, 4):
        k = year * 12
        swaption = model.swaption_price(Swaption(float(year), 5.0 - year, strike, 1, 1.0))
        assert profile.discounted_ee[k] == pytest.approx(swaption, rel=0.03)


def test_exposure_profile_shape(setup):
    _, _, _, profile = setup
    assert profile.discounted_ee[0] == pytest.approx(0.0, abs=1e-12)  # at par today
    assert profile.discounted_ee[-1] == 0.0  # everything paid
    peak = int(np.argmax(profile.epe))
    assert 0.5 < profile.times[peak] < 3.5  # the classic hump: diffusion vs amortisation
    assert np.all(profile.pfe95 >= profile.epe - 1e-12)


def test_payer_and_receiver_exposures_mirror(setup):
    model, strike, _, profile = setup
    receiver = swap_exposure(InterestRateSwap(strike, 5, 1, 1.0, False), model, paths=20_000)
    np.testing.assert_allclose(receiver.discounted_ee, -profile.discounted_ene, atol=1e-12)


def test_cva_dva_and_collateral(setup):
    model, _, payer, profile = setup
    counterparty = HazardCurve.flat(0.02)
    x = credit_adjustments(profile, counterparty, 0.4, HazardCurve.flat(0.01), 0.4)
    assert x.cva > 0 and x.dva > 0 and x.bilateral == pytest.approx(x.dva - x.cva)
    assert credit_adjustments(profile, HazardCurve.flat(0.0), 0.4).cva == 0.0
    # Doubling the hazard roughly doubles CVA when default probabilities are small.
    doubled = credit_adjustments(profile, HazardCurve.flat(0.04), 0.4).cva
    assert doubled == pytest.approx(2 * x.cva, rel=0.1)
    collateralised = swap_exposure(payer, model, paths=20_000, threshold=0.005)
    assert credit_adjustments(collateralised, counterparty, 0.4).cva < 0.5 * x.cva
