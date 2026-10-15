import pytest
from fastapi.testclient import TestClient

from derivlab_api.main import app

client = TestClient(app)


def post(path: str, **body):
    response = client.post(f"/api/rates/{path}", json=body)
    assert response.status_code == 200, response.text
    return response.json()


def test_curve_reprices_quotes_and_par_rates_match():
    body = post("curve")
    assert max(abs(e) for e in body["repricing_errors"]) < 1e-12
    par = dict(zip(body["par_tenors"], body["par_rates"], strict=True))
    assert par[5.0] == pytest.approx(0.037, abs=1e-12)


def test_custom_quotes():
    quotes = [
        {"kind": "deposit", "maturity": 0.5, "rate": 0.03},
        {"kind": "swap", "maturity": 2, "rate": 0.032},
        {"kind": "swap", "maturity": 10, "rate": 0.035},
    ]
    body = post("curve", quotes=quotes)
    assert len(body["node_times"]) == 3 and max(abs(e) for e in body["repricing_errors"]) < 1e-12


def test_swap_at_par_and_off_market():
    assert post("swap")["npv"] == pytest.approx(0, abs=1e-6)
    receiver = post("swap", fixed_rate=0.035, payer=False)
    assert (
        receiver["npv"] < 0 and receiver["dv01"] > 0
    )  # receiving below par loses; gains if rates fall
    assert len(receiver["shifted_npv"]) == len(receiver["shifts_bp"])


def test_bond_convexity_beats_duration():
    body = post("bond")
    # Exact prices sit above the duration line on both sides: positive convexity.
    for exact, linear in zip(body["exact"], body["duration_approx"], strict=True):
        assert exact >= linear - 1e-9


@pytest.mark.parametrize("product", ["cap", "floor", "payer", "receiver"])
def test_rate_options_atm(product):
    body = post("options", product=product)
    assert body["price"] > 0 and body["strike"] == pytest.approx(body["atm_forward"], rel=1e-2)
    assert body["equivalent_vol"] is not None
    assert len(body["smile_strikes"]) == len(body["smile_from_normal"])


def test_normal_model_implies_a_downward_black_skew():
    smile = [v for v in post("options")["smile_from_normal"] if v is not None]
    assert smile[0] > smile[-1]


def test_short_rate_models():
    body = post("short-rate")
    assert body["hull_white_zero"] == pytest.approx(
        body["market_zero"], abs=2e-4
    )  # HW fits the curve
    assert body["european_tree"] == pytest.approx(body["european_jamshidian"], rel=5e-3)
    assert body["bermudan_tree"] > body["european_tree"]


def test_hull_white_calibration():
    body = post("calibrate-hull-white")
    assert body["rmse"] < 0.02 and len(body["model_vols"]) == len(body["market_vols"])


def test_bad_quotes_rejected():
    response = client.post(
        "/api/rates/curve",
        json={"quotes": [{"kind": "fra", "maturity": 2, "rate": 0.03, "start": 1.5}]},
    )
    assert response.status_code == 422
