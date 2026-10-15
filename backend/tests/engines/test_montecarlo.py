import numpy as np
import pytest

from derivlab import AnalyticEngine, MonteCarloEngine, UnsupportedError
from derivlab.engines.montecarlo import gbm_paths
from tests.conftest import american, european


@pytest.mark.parametrize("kind", ["call", "put"])
@pytest.mark.parametrize("antithetic", [True, False])
@pytest.mark.parametrize("control_variate", [True, False])
def test_within_four_standard_errors(kind, antithetic, control_variate, market, model):
    exact = AnalyticEngine().price(european(kind), market, model).value
    result = MonteCarloEngine(
        paths=50_000, antithetic=antithetic, control_variate=control_variate
    ).price(european(kind), market, model)
    assert result.stderr is not None
    assert abs(result.value - exact) < 4 * result.stderr


def test_variance_reduction_shrinks_error(market, model):
    plain = MonteCarloEngine(antithetic=False, control_variate=False)
    reduced = MonteCarloEngine()
    option = european("call")
    reduced_se = reduced.price(option, market, model).stderr
    plain_se = plain.price(option, market, model).stderr
    assert reduced_se is not None and plain_se is not None
    assert reduced_se < plain_se / 1.5  # ~1.9x for an ATM call


def test_reproducible_with_seed(market, model):
    engine = MonteCarloEngine(paths=1000, seed=7)
    assert engine.price(european(), market, model) == engine.price(european(), market, model)


def test_multi_step_paths_match_terminal_distribution(market, model):
    paths = gbm_paths(market, model, 1.0, 12, 200_000, np.random.default_rng(1))
    assert paths.shape == (200_000, 13)
    assert np.all(paths[:, 0] == market.spot)
    # E[S_T] = S0 * exp((r - q) T)
    assert paths[:, -1].mean() == pytest.approx(market.forward(1.0), rel=2e-3)


def test_american_is_unsupported(market, model):
    with pytest.raises(UnsupportedError):
        MonteCarloEngine().price(american(), market, model)
