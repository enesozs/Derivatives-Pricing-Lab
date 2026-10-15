import pytest
from fastapi.testclient import TestClient

from derivlab_api.main import app

client = TestClient(app)


def post(path: str, **body):
    response = client.post(f"/api/credit/{path}", json=body)
    assert response.status_code == 200, response.text
    return response.json()


def test_cds_curve_and_contract():
    body = post("cds")
    assert max(abs(n["repricing_error"]) for n in body["nodes"]) < 1e-12
    assert body["par_spread"] == pytest.approx(0.0115)
    assert body["upfront"] == pytest.approx((0.0115 - 0.01) * body["rpv01"])
    assert body["cs01"] > 0  # protection buyer gains when spreads widen
    assert body["survival"][0] == 1.0


def test_cds_rejects_inverted_curve_that_needs_negative_hazard():
    response = client.post(
        "/api/credit/cds",
        json={"quotes": [{"maturity": 1, "spread": 0.05}, {"maturity": 5, "spread": 0.002}]},
    )
    assert response.status_code == 422


def test_xva():
    body = post("xva", maturity=5, paths=4_000)
    assert body["swap_value"] == pytest.approx(0.0, abs=1e-6)
    assert body["cva"] > 0 and body["dva"] > 0
    assert body["bilateral"] == pytest.approx(body["dva"] - body["cva"])
    for sim, exact in zip(body["check_simulated"], body["check_exact"], strict=True):
        assert sim == pytest.approx(exact, rel=0.08)
    unilateral = post("xva", maturity=5, paths=4_000, own_spread=None)
    assert unilateral["dva"] == 0.0
    collateral = post("xva", maturity=5, paths=4_000, threshold=50_000)
    assert collateral["cva"] < body["cva"]
