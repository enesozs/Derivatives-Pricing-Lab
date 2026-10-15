"""Longstaff–Schwartz: American (Bermudan) options by Monte Carlo.

Simulation runs forward in time, but early exercise is decided backwards: at each date the
holder compares exercising now with the *expected* value of continuing, which is a conditional
expectation, unknown on a single path. Longstaff & Schwartz (2001) estimate it by regressing
the discounted cash flows that each path realises later on simple functions of today's spot
(here polynomials in S/K), using only in-the-money paths. Then, going backwards:
- exercise where intrinsic value > fitted continuation value, and record that cash flow;
- otherwise keep the path's later cash flow.
The price is the average discounted cash flow.

Exercise is allowed on `exercise_dates` equally spaced dates, so this prices a Bermudan option.
That converges to the American price as the dates increase (50 dates is within ~0.01 for
typical inputs). The regression uses the same paths as the valuation, which biases the price
slightly upwards; the Bermudan restriction biases it downwards.

Works under any model with a path generator: unlike trees and PDEs, LSM handles stochastic
volatility, jumps and many assets with no extra effort, which is why it is the industry
standard for callable and American-style exotics.
Reference: Longstaff & Schwartz (2001), Review of Financial Studies 14(1); Glasserman ch. 8.
"""

import math
from dataclasses import dataclass

import numpy as np
from numpy.typing import NDArray

from derivlab.core.errors import UnsupportedError
from derivlab.instruments import Instrument, VanillaOption
from derivlab.market import Market
from derivlab.models import Model
from derivlab.results import PricingResult

from .paths import DISCRETISED_MODELS, simulate_paths


@dataclass(frozen=True)
class LSMResult:
    value: float
    stderr: float
    #: Exercise dates (years from today).
    times: NDArray[np.float64]
    #: Estimated exercise boundary per date: the spot at which exercise starts (NaN if none).
    boundary: NDArray[np.float64]
    #: A sample of (time, spot) points where simulated paths exercised, for plotting.
    exercise_points: NDArray[np.float64]


def longstaff_schwartz(
    option: VanillaOption,
    market: Market,
    model: Model,
    paths: int = 50_000,
    exercise_dates: int = 50,
    degree: int = 3,
    seed: int = 42,
    antithetic: bool = True,
    steps_per_year: int = 100,
) -> LSMResult:
    if exercise_dates < 1 or degree < 1 or paths < 100:
        raise ValueError("need exercise_dates >= 1, degree >= 1 and at least 100 paths")
    t = option.expiry
    steps = exercise_dates
    if isinstance(model, DISCRETISED_MODELS):
        steps *= max(1, math.ceil(steps_per_year * t / exercise_dates))
    stride = steps // exercise_dates
    rng = np.random.default_rng(seed)
    paths += paths % 2
    spots = simulate_paths(market, model, t, steps, paths, rng, antithetic)
    times = np.linspace(0.0, t, steps + 1)
    strike = option.payoff.strike

    cash = option.payoff(spots[:, -1])
    exercise_index = np.full(paths, steps)
    boundary = np.full(exercise_dates, np.nan)
    boundary[-1] = strike
    exercised_points: list[tuple[float, float]] = []

    for k in range(exercise_dates - 1, 0, -1):
        i = k * stride
        s = spots[:, i]
        intrinsic = option.payoff(s)
        itm = intrinsic > 0
        if itm.sum() <= degree + 1:
            continue
        # Discount each path's future cash flow back to this date.
        discounted = cash * np.exp(-market.rate * (times[exercise_index] - times[i]))
        x = s[itm] / strike
        basis = np.vander(x, degree + 1, increasing=True)
        coefficients, *_ = np.linalg.lstsq(basis, discounted[itm], rcond=None)
        continuation = basis @ coefficients
        exercise = np.zeros(paths, dtype=bool)
        exercise[np.flatnonzero(itm)[intrinsic[itm] > continuation]] = True
        cash = np.where(exercise, intrinsic, cash)
        exercise_index = np.where(exercise, i, exercise_index)
        if exercise.any():
            spots_ex = s[exercise]
            boundary[k - 1] = spots_ex.max() if option.payoff.kind == "put" else spots_ex.min()
            take = spots_ex[: max(1, 400 // exercise_dates)]
            exercised_points.extend((float(times[i]), float(v)) for v in take)

    samples = cash * np.exp(-market.rate * times[exercise_index])
    value = float(samples.mean())
    immediate = float(option.payoff(market.spot))
    if immediate > value:  # exercising today beats waiting
        value, samples = immediate, np.full(paths, immediate)
    if antithetic:
        half = paths // 2
        independent = 0.5 * (samples[:half] + samples[half:])
    else:
        independent = samples
    stderr = float(np.std(independent, ddof=1) / math.sqrt(len(independent)))
    exercise_times = times[stride::stride][:exercise_dates]
    return LSMResult(
        value, stderr, exercise_times, boundary, np.array(exercised_points).reshape(-1, 2)
    )


@dataclass(frozen=True)
class LongstaffSchwartzEngine:
    paths: int = 50_000
    exercise_dates: int = 50
    degree: int = 3
    seed: int = 42

    @property
    def label(self) -> str:
        return f"Longstaff–Schwartz MC · {self.paths:,} paths, {self.exercise_dates} dates"

    def price(self, option: Instrument, market: Market, model: Model) -> PricingResult:
        if not isinstance(option, VanillaOption):
            raise UnsupportedError(
                "Longstaff–Schwartz here prices vanilla American/Bermudan options"
            )
        if option.expiry == 0:
            return PricingResult(float(option.payoff(market.spot)), stderr=0.0)
        result = longstaff_schwartz(
            option, market, model, self.paths, self.exercise_dates, self.degree, self.seed
        )
        return PricingResult(
            result.value,
            stderr=result.stderr,
            diagnostics={"paths": self.paths, "exercise_dates": self.exercise_dates},
        )
