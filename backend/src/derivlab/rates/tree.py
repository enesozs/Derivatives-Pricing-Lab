"""Hull–White trinomial tree (Hull & White 1994), for products with early exercise.

1. Build a tree for x, where dx = -a x dt + sigma dW (no drift): spacing dx = sqrt(3 V),
   V = sigma^2 (1 - e^{-2a dt}) / (2a). Probabilities match the mean and variance of x over each
   step. The tree is truncated at |j| <= j_max, where branching bends inwards so probabilities
   stay positive.
2. Shift each time slice by alpha_m so the tree reprices today's discount curve exactly,
   solved forward with Arrow–Debreu prices Q.
3. Price by backward induction, discounting each step at the node's rate r = alpha_m + j dx.
Used here for Bermudan swaptions (exercisable on every fixed-leg date). They are worth at
least the European swaption with the same final maturity, and more the steeper the curve.
Reference: Hull & White (1994), "Numerical procedures for implementing term structure models
I"; Brigo & Mercurio ch. 3.3.
"""

import math
from dataclasses import dataclass

import numpy as np
from numpy.typing import NDArray

from .curve import DiscountCurve
from .options import Swaption


@dataclass
class _Tree:
    dt: float
    dx: float
    steps: int
    jmax: int
    alpha: NDArray[np.float64]
    #: For each step m: (child index offset k of the middle child, pu, pm, pd) per node j.
    branches: list[
        tuple[NDArray[np.int64], NDArray[np.float64], NDArray[np.float64], NDArray[np.float64]]
    ]

    def width(self, m: int) -> int:
        return min(m, self.jmax)

    def rates(self, m: int) -> NDArray[np.float64]:
        w = self.width(m)
        return self.alpha[m] + np.arange(-w, w + 1) * self.dx

    def rollback(self, m: int, values: NDArray[np.float64]) -> NDArray[np.float64]:
        """Values at step m from values at step m + 1."""
        middle, pu, pm, pd = self.branches[m]
        w_next = self.width(m + 1)
        idx = middle + w_next  # array index of the middle child
        expected = pu * values[idx + 1] + pm * values[idx] + pd * values[idx - 1]
        return np.exp(-self.rates(m) * self.dt) * expected


def build_tree(a: float, sigma: float, curve: DiscountCurve, horizon: float, steps: int) -> _Tree:
    dt = horizon / steps
    m_drift = math.exp(-a * dt) - 1
    variance = sigma**2 * (1 - math.exp(-2 * a * dt)) / (2 * a)
    dx = math.sqrt(3 * variance)
    jmax = max(1, math.ceil(0.184 / (-m_drift)))
    branches = []
    for m in range(steps):
        w = min(m, jmax)
        j = np.arange(-w, w + 1)
        jm = j * m_drift
        middle = j.copy()
        pu = 1 / 6 + (jm**2 + jm) / 2
        pm = 2 / 3 - jm**2
        pd = 1 / 6 + (jm**2 - jm) / 2
        top = j == jmax
        bottom = j == -jmax
        # Edges: branch down from the top node and up from the bottom node.
        pu = np.where(
            top, 7 / 6 + (jm**2 + 3 * jm) / 2, np.where(bottom, 1 / 6 + (jm**2 - jm) / 2, pu)
        )
        pm = np.where(top, -1 / 3 - jm**2 - 2 * jm, np.where(bottom, -1 / 3 - jm**2 + 2 * jm, pm))
        pd = np.where(
            top, 1 / 6 + (jm**2 + jm) / 2, np.where(bottom, 7 / 6 + (jm**2 - 3 * jm) / 2, pd)
        )
        middle = np.where(top, j - 1, np.where(bottom, j + 1, middle))
        branches.append((middle, pu, pm, pd))

    # Fit alpha forward with Arrow–Debreu prices.
    alpha = np.zeros(steps + 1)
    q = np.array([1.0])
    for m in range(steps):
        w = min(m, jmax)
        j = np.arange(-w, w + 1)
        target = curve.df((m + 1) * dt)
        alpha[m] = math.log(float(q @ np.exp(-j * dx * dt)) / target) / dt
        middle, pu, pm, pd = branches[m]
        w_next = min(m + 1, jmax)
        q_next = np.zeros(2 * w_next + 1)
        weight = q * np.exp(-(alpha[m] + j * dx) * dt)
        idx = middle + w_next
        np.add.at(q_next, idx + 1, weight * pu)
        np.add.at(q_next, idx, weight * pm)
        np.add.at(q_next, idx - 1, weight * pd)
        q = q_next
    alpha[steps] = alpha[steps - 1]
    return _Tree(dt, dx, steps, jmax, alpha, branches)


def bermudan_swaption(
    swaption: Swaption,
    a: float,
    sigma: float,
    curve: DiscountCurve,
    steps_per_period: int = 12,
    bermudan: bool = True,
) -> float:
    """Payer/receiver swaption exercisable at expiry and (if `bermudan`) every later fixed date.

    On exercise at date t_k the holder enters the remaining swap to the final maturity.
    """
    times, tau = swaption.schedule()
    end = swaption.expiry + swaption.tenor
    period = 1.0 / swaption.frequency
    steps = round(end / period) * steps_per_period
    tree = build_tree(a, sigma, curve, end, steps)

    def step_of(t: float) -> int:
        return round(t / tree.dt)

    exercise_dates = [swaption.expiry] + (list(times[:-1]) if bermudan else [])
    exercise_steps = sorted({step_of(t) for t in exercise_dates})
    # Zero-coupon bonds for every payment date, rolled back on the tree.
    payment_steps = [step_of(t) for t in times]
    bonds: dict[int, NDArray[np.float64]] = {}  # payment index -> values at current step
    values = np.zeros(2 * tree.width(steps) + 1)
    sign = 1 if swaption.payer else -1
    for m in range(steps, -1, -1):
        for i, ps in enumerate(payment_steps):
            if ps == m:
                bonds[i] = np.ones(2 * tree.width(m) + 1)
        if m in exercise_steps:
            t = m * tree.dt
            remaining = [i for i, pt in enumerate(times) if pt > t + 1e-9]
            if remaining:
                annuity = sum(tau[i] * bonds[i] for i in remaining)
                float_leg = 1 - bonds[remaining[-1]]
                # The floating leg restarts at the exercise date (single curve: worth 1 - P(t, T)).
                swap = sign * (float_leg - swaption.strike * annuity)
                values = np.maximum(values, swap)
        if m > 0:
            values = tree.rollback(m - 1, values)
            bonds = {i: tree.rollback(m - 1, v) for i, v in bonds.items()}
    return swaption.notional * float(values[0])
