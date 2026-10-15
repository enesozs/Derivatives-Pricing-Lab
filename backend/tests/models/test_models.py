import math

import numpy as np
import pytest

from derivlab import SABR, BlackScholes, Heston, LocalVol, Merton

MODELS = [
    BlackScholes(0.2),
    Heston(0.04, 1.5, 0.06, 0.5, -0.7),
    Merton(0.2, 1.0, -0.1, 0.15),
]


@pytest.mark.parametrize("model", MODELS, ids=lambda m: type(m).__name__)
def test_characteristic_function_basics(model):
    t, r, q = 1.3, 0.04, 0.01
    assert model.characteristic_function(np.array([0.0 + 0j]), t, r, q)[0] == pytest.approx(1.0)
    # Martingale: E[S_T / S_0] = phi(-i) = exp((r - q) T).
    assert model.characteristic_function(np.array([-1j]), t, r, q)[0].real == pytest.approx(
        math.exp((r - q) * t), rel=1e-12
    )


@pytest.mark.parametrize(
    "build",
    [
        lambda: Heston(-0.01, 1, 0.04, 0.5, -0.5),
        lambda: Heston(0.04, 0, 0.04, 0.5, -0.5),
        lambda: Heston(0.04, 1, 0.04, 0.5, -1.0),
        lambda: Merton(0.2, -1, 0, 0.1),
        lambda: SABR(0.2, 1.5, 0, 0.3),
        lambda: SABR(-0.2, 0.5, 0, 0.3),
    ],
)
def test_invalid_parameters(build):
    with pytest.raises(ValueError):
        build()


def test_feller_condition():
    assert Heston(0.04, 2.0, 0.04, 0.3, -0.5).feller_satisfied
    assert not Heston(0.04, 1.0, 0.04, 0.5, -0.5).feller_satisfied


def test_sabr_reduces_to_flat_lognormal_vol():
    # beta = 1 and no vol of vol: implied vol equals alpha everywhere.
    vols = SABR(0.25, 1.0, -0.3, 0.0).implied_volatility(100.0, [70, 100, 140], 1.0)
    assert np.allclose(vols, 0.25)


def test_sabr_matches_quantlib():
    ql = pytest.importorskip("QuantLib")
    model = SABR(0.3, 0.5, -0.4, 0.6)
    for strike in (80.0, 100.0, 125.0):
        ours = float(model.implied_volatility(100.0, strike, 2.0))
        theirs = ql.sabrVolatility(strike, 100.0, 2.0, 0.3, 0.5, 0.6, -0.4)
        assert ours == pytest.approx(theirs, rel=1e-6)


def test_local_vol_constant():
    lv = LocalVol.constant(0.3)
    assert np.allclose(lv(np.array([50.0, 100.0]), 0.5), 0.3)
