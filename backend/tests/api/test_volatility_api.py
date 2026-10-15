import pytest
from fastapi.testclient import TestClient

from derivlab.data import DEFAULT_HESTON
from derivlab_api.main import app

client = TestClient(app)


def post(path: str, **body):
    response = client.post(f"/api/volatility/{path}", json=body)
    assert response.status_code == 200, response.text
    return response.json()


def test_sources_lists_bundled_snapshot():
    body = client.get("/api/volatility/sources").json()
    assert body["snapshots"] and body["snapshots"][0]["ticker"] == "SPY"


@pytest.mark.parametrize("source", ["snapshot", "synthetic"])
def test_surface(source):
    body = post("surface", source=source)
    assert body["meta"]["synthetic"] == (source == "synthetic")
    assert len(body["slices"]) >= 5
    first = body["slices"][0]
    assert len(first["fit_k"]) == len(first["fit_vol"])
    assert first["svi"]["rmse"] < 0.01
    grid = body["grid"]
    assert len(grid["implied_vol"]) == len(grid["maturities"])
    assert len(grid["local_vol"][0]) == len(grid["log_moneyness"])


def test_synthetic_heston_calibration_recovers_parameters():
    body = post("calibrate", source="synthetic", model="heston")
    params = body["parameters"][0]
    assert params["rho"] == pytest.approx(DEFAULT_HESTON.rho, abs=0.05)
    assert params["v0"] == pytest.approx(DEFAULT_HESTON.v0, rel=0.05)
    assert body["rmse"] < 0.002
    assert body["feller_satisfied"] is DEFAULT_HESTON.feller_satisfied


def test_sabr_calibration_has_one_parameter_set_per_expiry():
    body = post("calibrate", source="snapshot", model="sabr", beta=0.5)
    assert len(body["parameters"]) == len(body["slices"])
    assert all(p["beta"] == 0.5 for p in body["parameters"])
    assert body["feller_satisfied"] is None


@pytest.mark.parametrize("model", ["black_scholes", "heston", "merton", "sabr"])
def test_model_smile(model):
    body = post("model-smile", params={"model": model})
    assert len(body["smiles"]) == 5
    smile = body["smiles"][-1]
    assert len(smile["strikes"]) == len(smile["implied_vol"])
    if model == "black_scholes":
        assert all(v == pytest.approx(0.2, abs=1e-6) for v in smile["implied_vol"] if v)
    assert (smile["density"] is None) == (model == "sabr")


def test_heston_negative_rho_gives_negative_skew():
    smile = post("model-smile", params={"model": "heston", "rho": -0.8})["smiles"][-1]
    vols = [v for v in smile["implied_vol"] if v]
    assert vols[0] > vols[-1]


def test_bad_ticker_rejected_by_validation():
    response = client.post("/api/volatility/surface", json={"source": "live", "ticker": "../x"})
    assert response.status_code == 422
