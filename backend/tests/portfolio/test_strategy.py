import numpy as np
import pytest

from derivlab import AnalyticEngine, BinomialEngine
from derivlab.portfolio import Position, Strategy, horizon_values, strategy_value
from tests.conftest import european

ENGINE = AnalyticEngine()


def straddle() -> Strategy:
    return Strategy((Position(european("call"), 1), Position(european("put"), 1)))


def test_values_and_greeks_add_up(market, model):
    total, legs = strategy_value(straddle(), market, model, ENGINE)
    assert total.value == pytest.approx(legs[0].value + legs[1].value)
    assert total.greeks is not None and legs[0].greeks is not None and legs[1].greeks is not None
    assert total.greeks.delta == pytest.approx(legs[0].greeks.delta + legs[1].greeks.delta)
    assert total.greeks.gamma == pytest.approx(2 * legs[0].greeks.gamma)


def test_short_position_flips_sign(market, model):
    long = strategy_value(Strategy((Position(european(), 1),)), market, model, ENGINE)[0]
    short = strategy_value(Strategy((Position(european(), -1),)), market, model, ENGINE)[0]
    assert short.value == pytest.approx(-long.value)


def test_covered_call_delta(market, model):
    covered = Strategy((Position(european("call"), -1),), underlying_quantity=1)
    total, legs = strategy_value(covered, market, model, ENGINE)
    assert total.greeks is not None and legs[0].greeks is not None
    assert total.greeks.delta == pytest.approx(1 - legs[0].greeks.delta)


def test_horizon_values_at_expiry_are_payoffs(market, model):
    spots = np.array([80.0, 100.0, 120.0])
    values = horizon_values(straddle(), market, model, ENGINE, spots, elapsed=1.0)
    assert values.tolist() == [20.0, 0.0, 20.0]


def test_calendar_spread_keeps_time_value_of_back_month(market, model):
    calendar = Strategy(
        (Position(european("call", expiry=0.5), -1), Position(european("call", expiry=1.0), 1))
    )
    assert calendar.horizon == 0.5
    at_front_expiry = horizon_values(calendar, market, model, ENGINE, [100.0], elapsed=0.5)
    assert at_front_expiry[0] > 0  # long back-month call still has time value


def test_engine_agnostic(market, model):
    tree, _ = strategy_value(straddle(), market, model, BinomialEngine(1000))
    exact, _ = strategy_value(straddle(), market, model, ENGINE)
    assert tree.value == pytest.approx(exact.value, abs=5e-3)


def test_empty_strategy_rejected():
    with pytest.raises(ValueError):
        Strategy(())
