import pytest
from fastapi.testclient import TestClient

from derivlab_api.main import app

client = TestClient(app)


def test_health():
    assert client.get("/api/health").json() == {"status": "ok"}


def test_price_european():
    body = client.post("/api/vanilla/price", json={}).json()
    assert body["reference"] == pytest.approx(10.450583572185565)
    assert body["greeks_label"] == "Analytic"
    statuses = {m["method"]: m["status"] for m in body["methods"]}
    assert statuses == {"analytic": "ok", "crr": "ok", "monte_carlo": "ok"}
    mc = next(m for m in body["methods"] if m["method"] == "monte_carlo")
    assert mc["ci_low"] < mc["value"] < mc["ci_high"]


def test_price_american_reports_unsupported_methods():
    body = client.post("/api/vanilla/price", json={"kind": "put", "exercise": "american"}).json()
    statuses = {m["method"]: m["status"] for m in body["methods"]}
    assert statuses == {"analytic": "unsupported", "crr": "ok", "monte_carlo": "unsupported"}
    assert body["greeks"]["delta"] < 0


def test_profile_and_convergence_shapes():
    profile = client.post("/api/vanilla/profile", json={}).json()
    assert len(profile["spots"]) == len(profile["value"]) == len(profile["delta"])
    conv = client.post("/api/vanilla/convergence", json={"exercise": "american"}).json()
    assert conv["lattice"] and not conv["monte_carlo"] and conv["monte_carlo_note"]


def test_invalid_input_is_422():
    assert client.post("/api/vanilla/price", json={"volatility": -1}).status_code == 422
