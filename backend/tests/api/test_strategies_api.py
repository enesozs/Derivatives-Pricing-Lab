import pytest
from fastapi.testclient import TestClient

from derivlab_api.main import app

client = TestClient(app)


def leg(kind, strike, quantity, expiry=1.0):
    return {"kind": kind, "strike": strike, "quantity": quantity, "expiry": expiry}


def analyze(**body):
    response = client.post("/api/strategies/analyze", json=body)
    assert response.status_code == 200, response.text
    return response.json()


def test_long_straddle():
    body = analyze(legs=[leg("call", 100, 1), leg("put", 100, 1)])
    premium = body["net_value"]
    assert premium == pytest.approx(10.4506 + 5.5735, abs=1e-3)
    # Breakevens at strike -/+ premium; loss capped at the premium, profit unbounded.
    low, high = body["breakevens"]
    assert low == pytest.approx(100 - premium, abs=0.1)
    assert high == pytest.approx(100 + premium, abs=0.1)
    assert body["max_loss"] == pytest.approx(-premium, abs=1e-6)
    assert body["max_profit"] is None


def test_bull_call_spread_is_bounded():
    body = analyze(legs=[leg("call", 100, 1), leg("call", 110, -1)])
    assert body["max_profit"] == pytest.approx(10 - body["net_value"], abs=1e-6)
    assert body["max_loss"] == pytest.approx(-body["net_value"], abs=1e-6)
    assert len(body["breakevens"]) == 1


def test_naked_short_call_has_unbounded_loss():
    body = analyze(legs=[leg("call", 100, -1)])
    assert body["max_loss"] is None
    assert body["net_value"] < 0  # credit received


def test_covered_call_and_calendar():
    covered = analyze(legs=[leg("call", 110, -1)], underlying_quantity=1)
    assert covered["max_profit"] is not None and covered["greeks"]["delta"] < 1
    calendar = analyze(legs=[leg("call", 100, -1, 0.25), leg("call", 100, 1, 1.0)])
    assert calendar["horizon"] == 0.25


def test_too_many_legs_rejected():
    response = client.post("/api/strategies/analyze", json={"legs": [leg("call", 100, 1)] * 9})
    assert response.status_code == 422


def test_american_legs_use_a_tree():
    body = analyze(legs=[{**leg("put", 100, 1), "exercise": "american"}])
    assert body["engine_label"].startswith("Leisen–Reimer")


def test_scenario_grid():
    response = client.post(
        "/api/strategies/scenarios",
        json={"legs": [leg("call", 100, 1), leg("put", 100, 1)], "elapsed": 0.25},
    )
    assert response.status_code == 200, response.text
    body = response.json()
    assert len(body["pnl"]) == len(body["vol_shifts"])
    assert all(len(row) == len(body["spots"]) for row in body["pnl"])
    # A long straddle gains when volatility rises: compare the middle column across shifts.
    mid = len(body["spots"]) // 2
    column = [row[mid] for row in body["pnl"]]
    assert column == sorted(column)
