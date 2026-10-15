import pytest
from fastapi.testclient import TestClient

from derivlab_api.main import app

client = TestClient(app)


def post(path: str, **body):
    response = client.post(f"/api/multi-asset/{path}", json=body)
    assert response.status_code == 200, response.text
    return response.json()


@pytest.mark.parametrize("product", ["exchange", "spread", "basket", "best_of", "worst_of"])
def test_two_asset_products_have_closed_forms(product):
    body = post("price", product=product, strike=5 if product == "spread" else 100, mc_paths=20_000)
    exact, mc = body["methods"]
    assert exact["status"] == "ok" and mc["status"] == "ok"
    tolerance = 0.02 * exact["value"] if product in ("spread", "basket") else 4 * mc["stderr"]
    assert abs(exact["value"] - mc["value"]) < tolerance + 1e-9
    assert len(body["correlation_grid"]) == len(body["correlation_values"])
    assert len(body["scatter_x"]) == len(body["scatter_pays"])


def test_correlation_sensitivity_signs():
    assert post("price", product="basket")["correlation_sensitivity"] > 0
    assert post("price", product="best_of")["correlation_sensitivity"] < 0
    assert post("price", product="worst_of")["correlation_sensitivity"] > 0


def test_three_asset_rainbow_falls_back_to_monte_carlo():
    body = post(
        "price", product="best_of", assets=[{"spot": 100, "volatility": 0.2}] * 3, mc_paths=10_000
    )
    assert body["methods"][0]["status"] == "unsupported"
    assert body["value_label"].startswith("Monte Carlo")


def test_invalid_correlation_for_three_assets():
    response = client.post(
        "/api/multi-asset/price", json={"assets": [{"spot": 100}] * 3, "correlation": -0.8}
    )
    assert response.status_code == 422


def test_quanto():
    body = post("quanto", correlation=0.4)
    assert abs(body["mc_value"] - body["value"]) < 4 * body["mc_stderr"]
    assert body["value"] < body["uncorrelated_value"]  # positive rho lowers the adjusted drift
    assert body["drift_adjustment"] == pytest.approx(-0.4 * 0.25 * 0.12)
