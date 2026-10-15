import pytest
from fastapi.testclient import TestClient

from derivlab_api.main import app

client = TestClient(app)


def post(path: str, **body):
    response = client.post(f"/api/structured/{path}", json=body)
    assert response.status_code == 200, response.text
    return response.json()


def test_autocallable_single_and_worst_of():
    single = post("autocallable")
    assert sum(single["redemption_probabilities"]) == pytest.approx(1.0)
    assert single["coupon_vs_correlation"] is None
    # Higher volatility needs a higher coupon to stay at par.
    assert single["coupon_vs_vol"]["y"][-1] > single["coupon_vs_vol"]["y"][0]
    worst = post("autocallable", assets=3, correlation=0.5)
    assert worst["fair_coupon"] > single["fair_coupon"]
    by_rho = worst["coupon_vs_correlation"]["y"]
    assert by_rho[0] > by_rho[-1]


def test_autocallable_heston_and_validation():
    heston = post("autocallable", model={"type": "heston"}, monitoring="daily", paths=4_000)
    assert 0.8 < heston["value"] < 1.1
    response = client.post(
        "/api/structured/autocallable", json={"assets": 2, "model": {"type": "heston"}}
    )
    assert response.status_code == 422
    response = client.post("/api/structured/autocallable", json={"maturity": 1.1})
    assert response.status_code == 422


def test_reverse_convertible():
    body = post("reverse-convertible", coupon=0.1, barrier=None)
    assert body["value"] == pytest.approx(body["bond"] + body["coupons"] + body["short_put"])
    assert body["barrier_hit_probability"] == 0.0
    assert body["redemption_hit"] == body["redemption_not_hit"]
    heston = post("reverse-convertible", model={"type": "heston"})
    assert heston["barrier_hit_probability"] is None


def test_variance_swap():
    body = post("variance", n_strikes=401, width=8)
    assert body["replicated_variance"] == pytest.approx(body["expected_variance"], rel=2e-3)
    assert body["convergence"]["y"][-1] == pytest.approx(body["expected_variance"], rel=1e-3)
    assert all(v == pytest.approx(0.25, abs=1e-6) for v in body["implied_vols"] if v)
    merton = post("variance", model={"type": "merton"}, paths=4_000)
    assert merton["replicated_variance"] < merton["expected_variance"]


def test_cliquet():
    body = post("cliquet", paths=10_000)
    assert body["closed_form"] == pytest.approx(body["black_scholes"]["value"], rel=0.01)
    assert set(body["value_vs_local_cap"]) == {"black_scholes", "heston"}
    fs = body["forward_start"]["black_scholes"]
    assert fs["value"] == pytest.approx(body["forward_start_closed_form"], abs=4 * fs["stderr"])


def test_portfolio_risk():
    positions = [
        {"product": "call", "strike": 100, "quantity": 10},
        {"product": "autocallable", "quantity": -1_000, "expiry": 2, "barrier": 60},
        {"product": "reverse_convertible", "quantity": -1_000, "barrier": 70},
        {"product": "down_in_put", "strike": 100, "barrier": 75, "quantity": 5},
        {"product": "digital_put", "strike": 90, "quantity": 3},
    ]
    body = post("risk", positions=positions)
    assert len(body["positions"]) == 5
    assert body["total"]["delta"] == pytest.approx(sum(p["delta"] for p in body["positions"]))
    zero = body["grid"][body["vol_shifts"].index(0.0)][body["spot_shifts"].index(0.0)]
    assert zero == pytest.approx(0.0, abs=1e-6)
    assert len(body["scenarios"]) == 7
