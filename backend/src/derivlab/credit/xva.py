"""Counterparty credit risk: exposure profiles and CVA / DVA for an interest-rate swap.

If the counterparty defaults while a trade is worth V > 0 to us, we lose (1 - R) V; if V < 0
we still owe it. The **exposure** is V^+. CVA is the price of that risk:

  CVA = (1 - R_c) E[ D(0, tau_c) V(tau_c)^+ 1{tau_c <= T} ]
      ~ (1 - R_c) sum_k EE*(t_k) PD_c(t_{k-1}, t_k),

with EE*(t) = E[D(0, t) V(t)^+] the discounted expected exposure, and default independent of
rates (no wrong-way risk). DVA is the mirror image, our own default on what we owe:
  DVA = (1 - R_own) sum_k |ENE*(t_k)| PD_own(t_{k-1}, t_k).
The fair value of the trade with credit risk is V - CVA + DVA (unilateral approximations,
ignoring who defaults first).

Exposure needs the future value of the swap in many scenarios, so we simulate the short rate
with Hull–White (it fits today's curve) and revalue the swap with the model's closed-form
bond prices on each path. A neat check: at a reset date, a payer swap's discounted expected
exposure *is* a payer swaption expiring then, so EE* matches Jamshidian's formula.

**Collateral** with a threshold H: the counterparty posts V - H when V > H, so exposure becomes
min(V^+, H) under perfect, instantaneous margining (no margin period of risk).
Reference: Gregory, *The xVA Challenge* (4th ed.), ch. 10-14; Brigo, Morini & Pallavicini,
*Counterparty Credit Risk, Collateral and Funding*, ch. 4.
"""

from dataclasses import dataclass

import numpy as np
from numpy.typing import NDArray

from derivlab.rates.products import InterestRateSwap
from derivlab.rates.short_rate import HullWhite

from .hazard import HazardCurve


@dataclass(frozen=True)
class ExposureProfile:
    times: NDArray[np.float64]
    #: Discounted expected positive / negative exposure: E[D V^+], E[D V^-] (<= 0).
    discounted_ee: NDArray[np.float64]
    discounted_ene: NDArray[np.float64]
    #: Undiscounted expected positive exposure and 95% potential future exposure.
    epe: NDArray[np.float64]
    pfe95: NDArray[np.float64]
    #: A few simulated swap values per time, for illustration (paths x times).
    sample_values: NDArray[np.float64]


def swap_exposure(
    swap: InterestRateSwap,
    model: HullWhite,
    paths: int = 5_000,
    steps_per_period: int = 12,
    seed: int = 42,
    threshold: float | None = None,
) -> ExposureProfile:
    """Simulate r(t) on a grid that contains every reset date; value the swap on each path.

    At time t in (t_{j-1}, t_j], the payer swap (per unit notional) is worth
      floating - fixed = P(t, t_j) / P(t_{j-1}, t_j) - P(t, T) - K sum_{i>=j} tau_i P(t, t_i),
    where P(t_{j-1}, t_j) was fixed on the path at the reset (single-curve floating leg)."""
    if swap.start != 0:
        raise ValueError("exposure is implemented for spot-starting swaps")
    pay, tau = swap.schedule()
    per = steps_per_period
    steps = per * len(pay)
    horizon = float(pay[-1])
    grid = np.linspace(0.0, horizon, steps + 1)
    r = model.simulate(horizon, steps, paths, seed)
    dt = horizon / steps
    integral = np.concatenate(
        [np.zeros((paths, 1)), np.cumsum(0.5 * (r[:, 1:] + r[:, :-1]) * dt, axis=1)], axis=1
    )
    discount = np.exp(-integral)
    sign = 1.0 if swap.payer else -1.0

    values = np.zeros((paths, steps + 1))
    reset_bond = np.ones(paths)  # P(t_{j-1}, t_j) on each path, set at each reset
    for k, t in enumerate(grid[:-1]):
        j = k // per  # current period: (pay[j] - tau[j], pay[j]]
        remaining = pay[j:]
        bonds = model.bond_price(float(t), remaining, r[:, k][:, None])  # (paths, m)
        if k % per == 0:  # reset date: fix the coupon for the period starting now
            reset_bond = bonds[:, 0]
        floating = bonds[:, 0] / reset_bond - bonds[:, -1]
        fixed = swap.fixed_rate * (bonds * tau[j:]).sum(axis=1)
        values[:, k] = sign * swap.notional * (floating - fixed)
    # At maturity everything has been paid.
    positive = np.maximum(values, 0.0)
    if threshold is not None:
        positive = np.minimum(positive, threshold)
    negative = np.minimum(values, 0.0)
    if threshold is not None:
        negative = np.maximum(negative, -threshold)
    return ExposureProfile(
        times=grid,
        discounted_ee=(discount * positive).mean(axis=0),
        discounted_ene=(discount * negative).mean(axis=0),
        epe=positive.mean(axis=0),
        pfe95=np.quantile(positive, 0.95, axis=0),
        sample_values=values[:8],
    )


@dataclass(frozen=True)
class XVA:
    cva: float
    dva: float
    #: Per time bucket: CVA and DVA contributions (where the risk comes from).
    cva_by_time: NDArray[np.float64]
    dva_by_time: NDArray[np.float64]

    @property
    def bilateral(self) -> float:
        """Adjustment to the risk-free value: -CVA + DVA."""
        return self.dva - self.cva


def credit_adjustments(
    profile: ExposureProfile,
    counterparty: HazardCurve,
    counterparty_recovery: float,
    own: HazardCurve | None = None,
    own_recovery: float = 0.4,
) -> XVA:
    t = profile.times
    pd_c = counterparty.default_probability(t[:-1], t[1:])
    ee_mid = 0.5 * (profile.discounted_ee[:-1] + profile.discounted_ee[1:])
    cva_by_time = (1 - counterparty_recovery) * ee_mid * pd_c
    if own is None:
        dva_by_time = np.zeros_like(cva_by_time)
    else:
        pd_own = own.default_probability(t[:-1], t[1:])
        ene_mid = -0.5 * (profile.discounted_ene[:-1] + profile.discounted_ene[1:])
        dva_by_time = (1 - own_recovery) * ene_mid * pd_own
    return XVA(float(cva_by_time.sum()), float(dva_by_time.sum()), cva_by_time, dva_by_time)


def cva_spread(cva: float, swap: InterestRateSwap, model: HullWhite) -> float:
    """CVA expressed as a running spread on the fixed rate (bp-style charge): CVA / annuity."""
    return cva / (swap.notional * swap.annuity(model.curve))


def flat_hazard_from_spread(spread: float, recovery: float) -> HazardCurve:
    """Credit triangle: lambda = s / (1 - R)."""
    return HazardCurve.flat(spread / (1 - recovery))


__all__ = [
    "XVA",
    "ExposureProfile",
    "credit_adjustments",
    "cva_spread",
    "flat_hazard_from_spread",
    "swap_exposure",
]
