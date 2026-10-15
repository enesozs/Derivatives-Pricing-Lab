import numpy as np

from derivlab import AnalyticEngine
from derivlab.research import (
    lattice_convergence,
    monte_carlo_convergence,
    reference_value,
    spot_profile,
)
from tests.conftest import american, european


def test_lattice_error_shrinks(market, model):
    option = european()
    points = lattice_convergence(option, market, model, reference_value(option, market, model))
    assert points[-1].abs_error < points[0].abs_error / 20


def test_monte_carlo_stderr_shrinks(market, model):
    points = monte_carlo_convergence(european(), market, model)
    assert points[-1].stderr < points[0].stderr / 5


def test_american_reference_uses_tree(market, model):
    assert reference_value(american(), market, model) > reference_value(
        european("put"), market, model
    )


def test_spot_profile(market, model):
    points = spot_profile(AnalyticEngine(), european(), market, model, np.linspace(50, 150, 11))
    values = [p.value for p in points]
    assert values == sorted(values)  # a call is increasing in spot
    assert all(p.value >= p.payoff - 1e-12 for p in points)  # never below intrinsic (q = 0)
