import numpy as np
import pytest

from derivlab import BlackScholes
from derivlab.hedging import hedge_frequency_study, simulate_delta_hedge
from tests.conftest import american, european


def test_hedging_error_matches_derman_kamal(market, model):
    result = simulate_delta_hedge(european(), market, model, rebalances=52, paths=4000)
    assert result.hedged_pnl.std() == pytest.approx(result.approx_std, rel=0.08)
    assert abs(result.hedged_pnl.mean()) < 0.1
    assert result.hedged_pnl.std() < result.unhedged_pnl.std() / 10


def test_error_shrinks_like_one_over_sqrt_n(market, model):
    points = hedge_frequency_study(european(), market, model, rebalances=(13, 208), paths=3000)
    assert points[0].std / points[1].std == pytest.approx(4, rel=0.15)


def test_selling_too_cheap_loses_money(market, model):
    # Sold at 15% vol while the market realises 20%: expected loss ~ vega * 5 vol points.
    result = simulate_delta_hedge(european(), market, model, hedge_volatility=0.15, paths=3000)
    assert result.hedged_pnl.mean() == pytest.approx(-1.9, abs=0.3)


def test_costs_are_charged(market, model):
    free = simulate_delta_hedge(european(), market, model, paths=500)
    costly = simulate_delta_hedge(european(), market, model, paths=500, cost_bps=10)
    assert np.all(costly.costs > 0)
    assert costly.hedged_pnl.mean() < free.hedged_pnl.mean()


def test_long_position_mirrors_short(market, model):
    short = simulate_delta_hedge(european(), market, model, position=-1, paths=500)
    long = simulate_delta_hedge(european(), market, model, position=1, paths=500)
    assert np.allclose(long.hedged_pnl, -short.hedged_pnl)


def test_sample_paths_start_at_zero_pnl(market, model):
    result = simulate_delta_hedge(european(), market, model, rebalances=10, paths=100, samples=3)
    assert result.sample_pnl.shape == (3, 11)
    assert np.allclose(result.sample_pnl[:, 0], 0)


def test_rejects_american(market):
    with pytest.raises(ValueError):
        simulate_delta_hedge(american(), market, BlackScholes(0.2))
