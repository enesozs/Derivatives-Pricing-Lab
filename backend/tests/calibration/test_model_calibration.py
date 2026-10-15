import pytest

from derivlab.calibration import calibrate_heston, calibrate_sabr
from derivlab.data import DEFAULT_HESTON, clean_chain, synthetic_chain


@pytest.fixture(scope="module")
def synthetic():
    return clean_chain(synthetic_chain())


def test_heston_recovers_the_generating_parameters(synthetic):
    fit = calibrate_heston(synthetic)
    assert fit.rmse < 0.002
    assert fit.model.v0 == pytest.approx(DEFAULT_HESTON.v0, rel=0.05)
    assert fit.model.theta == pytest.approx(DEFAULT_HESTON.theta, rel=0.05)
    assert fit.model.rho == pytest.approx(DEFAULT_HESTON.rho, abs=0.05)
    assert fit.model.xi == pytest.approx(DEFAULT_HESTON.xi, rel=0.1)
    assert fit.model.kappa == pytest.approx(DEFAULT_HESTON.kappa, rel=0.15)
    assert len(fit.slices) == len(synthetic.slices)


def test_sabr_fits_each_expiry(synthetic):
    fit = calibrate_sabr(synthetic, beta=1.0)
    assert len(fit.models) == len(synthetic.slices)
    assert fit.rmse < 0.005
    assert all(m.rho < 0 for m in fit.models)  # equity-style negative skew
