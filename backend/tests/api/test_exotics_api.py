import pytest
from fastapi.testclient import TestClient

from derivlab_api.main import app

client = TestClient(app)


def post(path: str, **body):
    response = client.post(f"/api/exotics/{path}", json=body)
    assert response.status_code == 200, response.text
    return response.json()


PRODUCTS = [
    {"type": "digital"},
    {"type": "barrier"},
    {"type": "barrier", "observations": 12},
    {"type": "asian"},
    {"type": "lookback"},
]


@pytest.mark.parametrize(
    "product", PRODUCTS, ids=lambda p: f"{p['type']}-{p.get('observations', '')}"
)
def test_price_black_scholes(product):
    body = post("price", product=product, mc_paths=20_000)
    statuses = {m["method"]: m["status"] for m in body["methods"]}
    assert statuses["monte_carlo"] == "ok"
    assert body["greeks"] is not None and body["vanilla_value"] > 0
    analytic = next(m for m in body["methods"] if m["method"] == "analytic")
    mc = next(m for m in body["methods"] if m["method"] == "monte_carlo")
    if analytic["status"] == "ok" and product.get("observations") is None:
        assert abs(analytic["value"] - mc["value"]) < 4 * mc["stderr"]


def test_barrier_cheaper_than_vanilla_and_pde_agrees():
    body = post("price", product={"type": "barrier"}, mc_paths=10_000)
    assert body["value"] < body["vanilla_value"]
    rows = {m["method"]: m for m in body["methods"]}
    assert rows["pde"]["value"] == pytest.approx(rows["analytic"]["value"], abs=2e-3)


def test_heston_uses_monte_carlo_without_greeks():
    body = post("price", product={"type": "asian"}, model={"type": "heston"}, mc_paths=10_000)
    assert body["value_label"].startswith("Monte Carlo")
    assert body["greeks"] is None


def test_profile_knock_out_is_worthless_beyond_barrier():
    body = post("profile", product={"type": "barrier", "barrier": 85})
    below = [v for s, v in zip(body["spots"], body["value"], strict=True) if s <= 85]
    assert below and all(v == 0 for v in below)
    assert len(body["delta"]) == len(body["spots"])


def test_paths_carry_payoff_mechanics():
    barrier = post("paths", product={"type": "barrier"})
    assert len(barrier["paths"]) == len(barrier["payoffs"]) == len(barrier["hit"])
    assert all(p == 0 for p, h in zip(barrier["payoffs"], barrier["hit"], strict=True) if h)
    asian = post("paths", product={"type": "asian", "fixings": 12})
    assert len(asian["fixing_times"]) == 12 and len(asian["averages"]) == len(asian["paths"])
    lookback = post("paths", product={"type": "lookback"})
    assert len(lookback["extremes"][0]) == len(lookback["times"])


def test_american_by_simulation():
    body = post("american", paths=20_000)
    assert body["european_value"] < body["lsm_value"]
    assert body["lsm_value"] == pytest.approx(body["reference_value"], abs=0.06)
    assert body["reference_boundary"] and body["convergence"]
    heston = post("american", paths=10_000, model={"type": "heston"})
    assert heston["reference_value"] is None and heston["lsm_value"] > heston["european_value"]
