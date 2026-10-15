import pytest
from fastapi.testclient import TestClient

from derivlab_api.main import FRONTEND_DIST, app

client = TestClient(app)


def test_recovers_volatility_from_black_scholes_price():
    body = client.post("/api/vanilla/implied-vol", json={"price": 10.450583572185565}).json()
    assert body["implied_vol"] == pytest.approx(0.20, abs=1e-8)
    assert body["message"] is None
    assert len(body["curve_vols"]) == len(body["curve_prices"]) > 10


def test_american_uses_tree():
    body = client.post(
        "/api/vanilla/implied-vol", json={"kind": "put", "exercise": "american", "price": 6.09}
    ).json()
    assert body["engine_label"].startswith("CRR")
    assert body["implied_vol"] == pytest.approx(0.20, abs=2e-3)


def test_arbitrage_violation_is_reported_not_raised():
    body = client.post("/api/vanilla/implied-vol", json={"price": 150}).json()
    assert body["implied_vol"] is None
    assert "no-arbitrage" in body["message"]
    assert body["price_upper"] == pytest.approx(100)


@pytest.mark.skipif(not FRONTEND_DIST.is_dir(), reason="frontend not built")
def test_client_side_routes_fall_back_to_the_app():
    # Browsers navigating to a deep link get index.html; React Router takes it from there.
    response = client.get("/vanilla/implied-vol", headers={"accept": "text/html"})
    assert response.status_code == 200
    assert '<div id="root">' in response.text
