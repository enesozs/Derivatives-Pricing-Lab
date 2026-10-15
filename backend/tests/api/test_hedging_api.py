import pytest
from fastapi.testclient import TestClient

from derivlab_api.main import app

client = TestClient(app)


def test_delta_hedge_endpoint():
    response = client.post("/api/hedging/delta", json={"paths": 1000})
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["hedged"]["std"] == pytest.approx(body["approx_std"], rel=0.15)
    assert body["hedged"]["std"] < body["unhedged"]["std"] / 5
    assert 980 <= sum(body["histogram"]["counts"]) <= 1000  # central 99%
    assert len(body["histogram"]["edges"]) == 41
    assert len(body["sample_pnl"]) == 3 and len(body["sample_pnl"][0]) == 53
    stds = [p["std"] for p in body["frequency"]]
    assert stds == sorted(stds, reverse=True)  # more re-balancing, smaller error


def test_volatility_misspecification_shows_in_mean():
    body = client.post(
        "/api/hedging/delta",
        json={"hedge_volatility": 0.15, "realised_volatility": 0.25, "paths": 1000},
    ).json()
    assert body["hedged"]["mean"] < -2  # sold far too cheap
