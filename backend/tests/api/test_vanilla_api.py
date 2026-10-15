import pytest
from fastapi.testclient import TestClient

from derivlab_api.main import app

client = TestClient(app)


def post(path: str, **body):
    response = client.post(f"/api/vanilla/{path}", json=body)
    assert response.status_code == 200, response.text
    return response.json()


def test_health():
    assert client.get("/api/health").json() == {"status": "ok"}


def test_price_european_all_methods_agree():
    body = post("price")
    assert body["reference"] == pytest.approx(10.450583572185565)
    assert body["greeks_label"] == "Analytic"
    rows = {m["method"]: m for m in body["methods"]}
    assert set(rows) == {"analytic", "crr", "leisen_reimer", "pde", "monte_carlo"}
    assert all(m["status"] == "ok" for m in rows.values())
    assert rows["leisen_reimer"]["abs_error"] < 1e-5
    assert rows["pde"]["abs_error"] < 1e-3
    mc = rows["monte_carlo"]
    assert mc["ci_low"] < mc["value"] < mc["ci_high"]
    assert all(m["greeks"] is not None for m in rows.values())


def test_price_american_reports_unsupported_methods():
    body = post("price", kind="put", exercise="american")
    statuses = {m["method"]: m["status"] for m in body["methods"]}
    assert statuses["analytic"] == statuses["monte_carlo"] == "unsupported"
    assert statuses["crr"] == statuses["leisen_reimer"] == statuses["pde"] == "ok"
    assert body["greeks_label"].startswith("Leisen–Reimer")
    assert body["greeks"]["delta"] < 0


def test_profile_and_convergence_shapes():
    profile = post("profile")
    assert len(profile["spots"]) == len(profile["value"]) == len(profile["delta"])
    conv = post("convergence", exercise="american")
    assert conv["crr"] and conv["leisen_reimer"] and conv["pde"]
    assert not conv["monte_carlo"] and conv["monte_carlo_note"]
    assert conv["pde"][-1]["abs_error"] < conv["pde"][0]["abs_error"]


def test_tree_endpoint():
    body = post("tree", kind="put", exercise="american", steps=4, scheme="crr")
    assert len(body["nodes"]) == 15
    assert body["up"] * body["down"] == pytest.approx(1.0)  # CRR is symmetric in log space
    assert any(n["exercised"] for n in body["nodes"])


def test_pde_grid_endpoint():
    body = post("pde-grid", kind="put", exercise="american")
    assert len(body["slices"]) == 5
    assert all(len(s["values"]) == len(body["spots"]) for s in body["slices"])
    boundary = [b for b in body["boundary_spots"] if b is not None]
    assert boundary and all(b < 100 for b in boundary)  # a put is exercised below the strike
    assert post("pde-grid")["boundary_spots"] == []  # European: no early exercise


def test_invalid_input_is_422():
    assert client.post("/api/vanilla/price", json={"volatility": -1}).status_code == 422
