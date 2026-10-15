"""Finite-difference solver for the Black–Scholes PDE, European and American vanilla options.

In log-spot x = ln S and time-to-expiry tau, the Black–Scholes PDE has constant coefficients:

    dV/dtau = 1/2 sigma^2 V_xx + (r - q - 1/2 sigma^2) V_x - r V

We solve it on a uniform x-grid centred on today's spot (so the answer sits on a node, no
interpolation) spanning +/- `width` standard deviations, marching from the payoff at tau = 0 to
tau = T with the theta-scheme:

- Crank–Nicolson (theta = 1/2) is second order in time, but the payoff's kink at the strike
  makes it ring. Rannacher smoothing replaces the first two steps with four half-size fully
  implicit steps, which damps the oscillation and keeps second-order convergence.
- American exercise: the penalty method (Forsyth & Vetzal 2002) adds a large penalty wherever
  the solution falls below the payoff, then re-solves until the set of exercised nodes stops
  changing (usually 2-3 iterations per step).

Local volatility: with sigma = sigma(S, t) the coefficients vary by node and step; they are
re-evaluated every step at the step's midpoint in calendar time. This is how Dupire local-vol
models are priced in practice, and it reproduces the surface they were built from.

Boundaries: Dirichlet values from the asymptotic option value far in/out of the money.
Error: O(dx^2 + dtau^2) for European options.
References: Duffy, Finite Difference Methods in Financial Engineering, ch. 13-16;
Rannacher (1984); Forsyth & Vetzal (2002), SIAM J. Sci. Comput. 23(6).
"""

import math
from dataclasses import dataclass, replace

import numpy as np
from numpy.typing import NDArray
from scipy.linalg import solve_banded

from derivlab.core.errors import UnsupportedError
from derivlab.instruments import VanillaOption
from derivlab.market import Market
from derivlab.models import BlackScholes, LocalVol, Model
from derivlab.results import Greeks, PricingResult

PDEModel = BlackScholes | LocalVol

_PENALTY = 1e8
_RANNACHER_STEPS = 2
_VOL_BUMP = 1e-3
_RATE_BUMP = 1e-4


@dataclass(frozen=True)
class PDESolution:
    """The full solution grid, for visualisation: values[i, j] at tau[i] and spots[j]."""

    spots: NDArray[np.float64]
    taus: NDArray[np.float64]
    values: NDArray[np.float64]
    #: True where early exercise is optimal (American only).
    exercised: NDArray[np.bool_]


def _boundaries(
    option: VanillaOption, market: Market, s_low: float, s_high: float, tau: float
) -> tuple[float, float]:
    """Option value at the grid edges: deep out of the money -> 0, deep in -> discounted forward."""
    df_r, df_q = market.discount(tau), math.exp(-market.dividend_yield * tau)
    if option.payoff.kind == "call":
        low, high = 0.0, s_high * df_q - option.payoff.strike * df_r
    else:
        low, high = option.payoff.strike * df_r - s_low * df_q, 0.0
    if option.is_american:
        low = max(low, float(option.payoff(s_low)))
        high = max(high, float(option.payoff(s_high)))
    return low, high


def _reference_volatility(option: VanillaOption, market: Market, model: PDEModel) -> float:
    """A single volatility to size the grid with."""
    if isinstance(model, BlackScholes):
        return model.volatility
    probe = np.array([market.spot])
    samples = [float(model(probe, t)[0]) for t in (0.0, 0.5 * option.expiry, option.expiry)]
    return max(max(samples), 0.05)


def grid_half_width(
    option: VanillaOption, market: Market, model: PDEModel, width: float = 5.0
) -> float:
    """Half-width of the log-spot grid: `width` std devs, wide enough to contain the strike.

    Bumped re-pricings reuse the base grid so the strike keeps its position between nodes.
    """
    sigma = _reference_volatility(option, market, model)
    spread = width * sigma * math.sqrt(option.expiry)
    return max(spread, 1.5 * abs(math.log(option.payoff.strike / market.spot)) + 0.1)


def solve_pde(
    option: VanillaOption,
    market: Market,
    model: PDEModel,
    space_steps: int = 400,
    time_steps: int = 200,
    width: float = 5.0,
    keep_grid: bool = False,
    half_width: float | None = None,
) -> tuple[
    NDArray[np.float64], NDArray[np.float64], NDArray[np.float64], float, PDESolution | None
]:
    """March the PDE to tau = T.

    Returns (spots, values at T, values one step earlier, dtau of that last step, optional grid).
    The explicit half of each step uses the previous boundary values (they are part of `values`).
    """
    if space_steps < 20 or time_steps < 10:
        raise ValueError("grid too small: need at least 20 space and 10 time steps")
    t = option.expiry
    space_steps += space_steps % 2  # even, so today's spot is the middle node
    if half_width is None:
        half_width = grid_half_width(option, market, model, width)
    x = math.log(market.spot) + np.linspace(-half_width, half_width, space_steps + 1)
    spots = np.exp(x)
    dx = x[1] - x[0]

    payoff = option.payoff(spots)
    values = payoff.copy()

    carry = market.rate - market.dividend_yield
    inner_spots = spots[1:-1]

    def operator(calendar_time: float):
        """Spatial operator L as three diagonals (sub, main, super) on interior nodes."""
        if isinstance(model, BlackScholes):
            variance = np.full_like(inner_spots, model.volatility**2)
        else:
            variance = model(inner_spots, max(calendar_time, 0.0)) ** 2
        alpha = 0.5 * variance / dx**2
        beta = (carry - 0.5 * variance) / (2 * dx)
        return alpha - beta, -2 * alpha - market.rate, alpha + beta

    sub, main, sup = operator(0.0)

    n_inner = space_steps - 1
    dtau = t / time_steps
    schedule = [(dtau / 2, 1.0)] * (2 * _RANNACHER_STEPS) + [(dtau, 0.5)] * (
        time_steps - _RANNACHER_STEPS
    )

    grid_values = [values.copy()] if keep_grid else []
    grid_exercised = [np.zeros_like(values, dtype=bool)] if keep_grid else []
    taus = [0.0]
    tau = 0.0
    previous = values
    exercised = np.zeros(space_steps + 1, dtype=bool)
    for step, theta in schedule:
        previous = values
        tau_new = tau + step
        low_new, high_new = _boundaries(option, market, spots[0], spots[-1], tau_new)
        if isinstance(model, LocalVol):
            sub, main, sup = operator(t - (tau + 0.5 * step))

        inner = values[1:-1]
        explicit = (1 - theta) * step
        rhs = inner + explicit * (sub * values[:-2] + main * inner + sup * values[2:])
        implicit = theta * step
        rhs[0] += implicit * sub[0] * low_new
        rhs[-1] += implicit * sup[-1] * high_new

        bands = np.zeros((3, n_inner))
        bands[0, 1:] = -implicit * sup[:-1]
        bands[1, :] = 1 - implicit * main
        bands[2, :-1] = -implicit * sub[1:]

        if option.is_american:
            target = payoff[1:-1]
            active = np.zeros(n_inner, dtype=bool)
            for _ in range(50):
                penalised = bands.copy()
                penalised[1] += np.where(active, _PENALTY, 0.0)
                solution = solve_banded(
                    (1, 1), penalised, rhs + np.where(active, _PENALTY * target, 0.0)
                )
                new_active = solution < target
                if np.array_equal(new_active, active):
                    break
                active = new_active
            else:
                raise RuntimeError("penalty iteration did not converge")
            # The penalty enforces V >= payoff to ~1/_PENALTY; snap to the payoff exactly.
            solution = np.maximum(solution, target)
            exercised = np.concatenate([[False], active, [False]])
        else:
            solution = solve_banded((1, 1), bands, rhs)

        values = np.concatenate([[low_new], solution, [high_new]])
        tau = tau_new
        if keep_grid:
            grid_values.append(values.copy())
            grid_exercised.append(exercised.copy())
            taus.append(tau)

    grid = (
        PDESolution(spots, np.asarray(taus), np.asarray(grid_values), np.asarray(grid_exercised))
        if keep_grid
        else None
    )
    return spots, values, previous, schedule[-1][0], grid


@dataclass(frozen=True)
class FiniteDifferenceEngine:
    space_steps: int = 400
    time_steps: int = 200
    #: Skip vega and rho (four extra solves) when only the value is needed.
    greeks: bool = True

    @property
    def label(self) -> str:
        return f"Crank–Nicolson PDE · {self.space_steps}×{self.time_steps}"

    def _value(
        self, option: VanillaOption, market: Market, model: PDEModel, half_width: float
    ) -> float:
        spots, values, *_ = solve_pde(
            option, market, model, self.space_steps, self.time_steps, half_width=half_width
        )
        return float(values[len(spots) // 2])

    def price(self, option: VanillaOption, market: Market, model: Model) -> PricingResult:
        if not isinstance(model, BlackScholes | LocalVol):
            raise UnsupportedError(
                f"The PDE engine solves Black–Scholes and local-volatility models, not "
                f"{type(model).__name__}"
            )
        if option.expiry == 0:
            return PricingResult(float(option.payoff(market.spot)))
        if isinstance(model, BlackScholes) and model.volatility == 0:
            raise ValueError("the PDE engine needs positive volatility")

        half_width = grid_half_width(option, market, model)
        spots, values, _, _, _ = solve_pde(
            option, market, model, self.space_steps, self.time_steps, half_width=half_width
        )
        mid = len(spots) // 2
        if not self.greeks or isinstance(model, LocalVol):
            # Local vol has no single volatility to bump, so no vega; value only.
            return PricingResult(float(values[mid]))
        s = spots[mid]
        dx = math.log(spots[1] / spots[0])
        v_x = (values[mid + 1] - values[mid - 1]) / (2 * dx)
        v_xx = (values[mid + 1] - 2 * values[mid] + values[mid - 1]) / dx**2
        delta = v_x / s
        gamma = (v_xx - v_x) / s**2
        if option.is_american and values[mid] <= option.payoff(s) + 1e-12:
            theta = 0.0  # exercised now: the option is worth its payoff and has no time decay
        else:
            # The PDE itself gives theta = dV/dt from the space derivatives, to second order:
            # theta = rV - (r - q) S delta - 1/2 sigma^2 S^2 gamma.
            theta = (
                market.rate * values[mid]
                - (market.rate - market.dividend_yield) * s * delta
                - 0.5 * model.volatility**2 * s * s * gamma
            )

        h = min(_VOL_BUMP, model.volatility / 2)
        vega = (
            self._value(option, market, replace(model, volatility=model.volatility + h), half_width)
            - self._value(
                option, market, replace(model, volatility=model.volatility - h), half_width
            )
        ) / (2 * h)
        rho = (
            self._value(option, replace(market, rate=market.rate + _RATE_BUMP), model, half_width)
            - self._value(option, replace(market, rate=market.rate - _RATE_BUMP), model, half_width)
        ) / (2 * _RATE_BUMP)

        return PricingResult(
            float(values[mid]),
            greeks=Greeks(float(delta), float(gamma), vega, float(theta), rho),
            diagnostics={"space_steps": self.space_steps, "time_steps": self.time_steps},
        )
