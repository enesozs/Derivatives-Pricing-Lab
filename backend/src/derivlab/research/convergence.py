"""Convergence studies: how fast each numerical engine approaches the true value."""

from collections.abc import Iterable
from dataclasses import dataclass

from derivlab.engines import AnalyticEngine, CRREngine, MonteCarloEngine
from derivlab.instruments import VanillaOption
from derivlab.market import Market
from derivlab.models import BlackScholes

# American options have no closed form; a very fine tree stands in as the benchmark.
REFERENCE_TREE_STEPS = 5000


@dataclass(frozen=True)
class LatticePoint:
    steps: int
    value: float
    abs_error: float


@dataclass(frozen=True)
class MonteCarloPoint:
    paths: int
    value: float
    stderr: float


def reference_value(option: VanillaOption, market: Market, model: BlackScholes) -> float:
    """Closed form for European options, a 5000-step CRR tree for American ones."""
    if option.is_american:
        return CRREngine(REFERENCE_TREE_STEPS).price(option, market, model).value
    return AnalyticEngine().price(option, market, model).value


def lattice_convergence(
    option: VanillaOption,
    market: Market,
    model: BlackScholes,
    reference: float,
    steps: Iterable[int] = (10, 20, 40, 80, 160, 320, 640, 1280),
) -> list[LatticePoint]:
    points = []
    for n in steps:
        value = CRREngine(n).price(option, market, model).value
        points.append(LatticePoint(n, value, abs(value - reference)))
    return points


def monte_carlo_convergence(
    option: VanillaOption,
    market: Market,
    model: BlackScholes,
    paths: Iterable[int] = (1_000, 2_000, 5_000, 10_000, 20_000, 50_000, 100_000, 200_000),
    seed: int = 42,
) -> list[MonteCarloPoint]:
    """Estimates at increasing path counts; each uses an independent stream (seed + i)."""
    points = []
    for i, n in enumerate(paths):
        result = MonteCarloEngine(paths=n, seed=seed + i).price(option, market, model)
        points.append(MonteCarloPoint(n, result.value, result.stderr or 0.0))
    return points
