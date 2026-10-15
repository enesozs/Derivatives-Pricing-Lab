"""Convergence studies: how fast each numerical engine approaches the true value."""

from collections.abc import Iterable
from dataclasses import dataclass

from derivlab.engines import (
    AnalyticEngine,
    BinomialEngine,
    FiniteDifferenceEngine,
    MonteCarloEngine,
)
from derivlab.engines.lattice import Scheme
from derivlab.instruments import VanillaOption
from derivlab.market import Market
from derivlab.models import BlackScholes

# American options have no closed form; a fine Leisen–Reimer tree stands in as the benchmark.
REFERENCE_STEPS = 4001
REFERENCE_LABEL_AMERICAN = f"Leisen–Reimer tree · {REFERENCE_STEPS:,} steps"
REFERENCE_LABEL_EUROPEAN = "Black–Scholes closed form"


@dataclass(frozen=True)
class ConvergencePoint:
    #: Tree steps, or PDE space steps (time steps are half of that).
    steps: int
    value: float
    abs_error: float


@dataclass(frozen=True)
class MonteCarloPoint:
    paths: int
    value: float
    stderr: float


def reference_value(option: VanillaOption, market: Market, model: BlackScholes) -> float:
    if option.is_american:
        engine = BinomialEngine(REFERENCE_STEPS, "leisen-reimer", greeks=False)
        return engine.price(option, market, model).value
    return AnalyticEngine().price(option, market, model).value


def lattice_convergence(
    option: VanillaOption,
    market: Market,
    model: BlackScholes,
    reference: float,
    scheme: Scheme = "crr",
    steps: Iterable[int] = (10, 20, 40, 80, 160, 320, 640, 1280),
) -> list[ConvergencePoint]:
    points = []
    for n in steps:
        result = BinomialEngine(n, scheme, greeks=False).price(option, market, model)
        points.append(ConvergencePoint(n, result.value, abs(result.value - reference)))
    return points


def pde_convergence(
    option: VanillaOption,
    market: Market,
    model: BlackScholes,
    reference: float,
    space_steps: Iterable[int] = (40, 80, 160, 320, 640),
) -> list[ConvergencePoint]:
    points = []
    for n in space_steps:
        result = FiniteDifferenceEngine(n, n // 2, greeks=False).price(option, market, model)
        points.append(ConvergencePoint(n, result.value, abs(result.value - reference)))
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
        result = MonteCarloEngine(paths=n, seed=seed + i, greeks=False).price(option, market, model)
        points.append(MonteCarloPoint(n, result.value, result.stderr or 0.0))
    return points
