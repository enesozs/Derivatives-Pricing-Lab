"""Helpers shared by the structured products: pricing any instrument with the best available
engine, and Monte Carlo statistics."""

import math

import numpy as np
from numpy.typing import NDArray

from derivlab.core.errors import UnsupportedError
from derivlab.engines import AnalyticEngine, CosEngine, MonteCarloEngine
from derivlab.instruments import Instrument
from derivlab.market import Market
from derivlab.models import Model

#: Paths per simulated batch: keeps memory bounded for daily grids and several assets.
BATCH = 4_000


def price_instrument(
    instrument: Instrument, market: Market, model: Model, mc_paths: int = 50_000, seed: int = 7
) -> float:
    """Closed form if there is one, then Fourier, then Monte Carlo (fixed seed, so revaluing
    under bumped inputs uses common random numbers and differences are smooth)."""
    for engine in (AnalyticEngine(), CosEngine()):
        try:
            return engine.price(instrument, market, model).value
        except UnsupportedError:
            continue
    mc = MonteCarloEngine(paths=mc_paths, seed=seed, greeks=False)
    return mc.price(instrument, market, model).value


def mean_and_stderr(samples: NDArray[np.float64], antithetic: bool = True) -> tuple[float, float]:
    """Antithetic samples come in mirrored halves; average each pair before the variance."""
    if antithetic and len(samples) % 2 == 0:
        half = len(samples) // 2
        pairs = 0.5 * (samples[:half] + samples[half:])
        return float(pairs.mean()), float(pairs.std(ddof=1) / math.sqrt(half))
    return float(samples.mean()), float(samples.std(ddof=1) / math.sqrt(len(samples)))


def batch_sizes(paths: int) -> list[int]:
    """Even batch sizes summing to `paths` (each batch keeps its own antithetic pairs)."""
    if paths < 2 or paths % 2:
        raise ValueError("paths must be an even number >= 2")
    sizes = [BATCH] * (paths // BATCH)
    if paths % BATCH:
        sizes.append(paths % BATCH)
    return sizes


def pair_order(per_batch: list[NDArray[np.float64]]) -> NDArray[np.float64]:
    """Concatenate batch results so that rows i and i + n/2 are still antithetic partners."""
    firsts = [b[: len(b) // 2] for b in per_batch]
    seconds = [b[len(b) // 2 :] for b in per_batch]
    return np.concatenate(firsts + seconds)
