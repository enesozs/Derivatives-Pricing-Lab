import numpy as np
import pytest

from derivlab import AnalyticEngine, BlackScholes, FiniteDifferenceEngine, Market
from derivlab.calibration import SurfaceSlice, SVIParams, VolSurface, build_surface, fit_svi
from derivlab.calibration.svi import SVIFit
from derivlab.data import clean_chain, synthetic_chain
from derivlab.instruments import European, PlainVanilla, VanillaOption

TRUE = SVIParams(a=0.02, b=0.1, rho=-0.5, m=0.05, sigma=0.15)


def test_svi_recovers_known_parameters():
    k = np.linspace(-0.4, 0.4, 41)
    vols = TRUE.implied_vol(k, 1.0)
    fit = fit_svi(k, vols, 1.0)
    assert fit.rmse < 1e-6
    for name in ("a", "b", "rho", "m", "sigma"):
        assert getattr(fit.params, name) == pytest.approx(getattr(TRUE, name), abs=1e-4)
    assert fit.butterfly_violations == ()


def test_durrleman_detects_butterfly_arbitrage():
    k = np.linspace(-0.5, 0.5, 101)
    assert np.all(TRUE.durrleman(k) > 0)
    bad = SVIParams(a=0.0, b=2.0, rho=0.9, m=0.0, sigma=0.01)  # wings far too steep
    assert np.any(bad.durrleman(k) < 0)


def _flat_surface(vol: float) -> VolSurface:
    def flat(t: float) -> SurfaceSlice:
        params = SVIParams(a=vol**2 * t, b=0.0, rho=0.0, m=0.0, sigma=0.1)
        return SurfaceSlice(t, 100 * np.exp(0.03 * t), np.exp(-0.03 * t), SVIFit(params, 0.0, ()))

    return VolSurface(100.0, [flat(0.25), flat(1.0), flat(2.0)])


def test_flat_surface_has_flat_local_vol():
    surface = _flat_surface(0.2)
    for t in (0.1, 0.5, 1.5, 3.0):
        assert np.allclose(surface.implied_vol([70, 100, 130], t), 0.2)
        assert np.allclose(surface.local_vol([70, 100, 130], t), 0.2, atol=1e-6)


def test_calendar_violation_detected():
    high = SurfaceSlice(0.5, 100.0, 1.0, SVIFit(SVIParams(0.04, 0.0, 0.0, 0.0, 0.1), 0.0, ()))
    low = SurfaceSlice(1.0, 100.0, 1.0, SVIFit(SVIParams(0.02, 0.0, 0.0, 0.0, 0.1), 0.0, ()))
    violations = VolSurface(100.0, [high, low]).calendar_violations()
    assert len(violations) == 1 and violations[0].t_long == 1.0


@pytest.fixture(scope="module")
def synthetic_surface():
    data = clean_chain(synthetic_chain())
    return data, build_surface(data)


def test_synthetic_surface_fits_and_is_arbitrage_free(synthetic_surface):
    _, surface = synthetic_surface
    assert all(s.fit.rmse < 0.003 for s in surface.slices)
    assert surface.calendar_violations() == []


def test_dupire_local_vol_reprices_the_surface(synthetic_surface):
    """Pricing with the Dupire local vol should give back the market's implied volatilities."""
    data, surface = synthetic_surface
    model = surface.local_vol_model()
    sl = data.slices[6]  # 1 year
    market = Market(data.spot, sl.rate, sl.rate - np.log(sl.forward / data.spot) / sl.t)
    engine = FiniteDifferenceEngine(400, 200, greeks=False)
    for point in sl.points[8::8]:
        option = VanillaOption(PlainVanilla(point.kind, point.strike), European(sl.t))
        price = engine.price(option, market, model).value
        exact = AnalyticEngine().price(option, market, BlackScholes(point.implied_vol))
        assert exact.greeks is not None
        bs, vega = exact.value, exact.greeks.vega
        assert abs(price - bs) / vega < 0.005  # within half a vol point
