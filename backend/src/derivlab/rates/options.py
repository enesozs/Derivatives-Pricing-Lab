"""Caps, floors and European swaptions under Black-76 (lognormal) and Bachelier (normal).

A cap is a strip of caplets; caplet i pays tau_i * max(L_i - K, 0) at t_i, where L_i is the
rate fixed at t_{i-1}. Under the t_i-forward measure L_i is a martingale, so each caplet is a
call on a forward rate:
  Black-76:  tau DF(t_i) [F N(d1) - K N(d2)],  d1 = (ln(F/K) + sigma^2 T/2) / (sigma sqrt T)
  Bachelier: tau DF(t_i) [(F - K) N(d) + sigma_n sqrt T n(d)],  d = (F - K) / (sigma_n sqrt T)
A payer swaption is a call on the forward swap rate S with the annuity as numeraire:
  value = annuity * Black(S, K, T, sigma).
Black vols are quoted in % of the rate, normal (Bachelier) vols in bp. The normal model allows
negative rates, which is why markets moved to normal vols after 2014.
Reference: Hull ch. 29; Brigo & Mercurio ch. 6; Bachelier (1900).
"""

import math
from dataclasses import dataclass
from typing import Literal

import numpy as np

from derivlab.core.roots import find_root
from derivlab.core.stats import norm_cdf as N
from derivlab.core.stats import norm_pdf as n

from .curve import DiscountCurve
from .schedule import accruals, payment_times

VolModel = Literal["black", "bachelier"]


def black(forward: float, strike: float, t: float, vol: float, call: bool) -> float:
    """Undiscounted Black-76 value."""
    if t <= 0 or vol <= 0:
        return max((forward - strike) if call else (strike - forward), 0.0)
    if forward <= 0 or strike <= 0:
        raise ValueError("Black-76 needs positive forward and strike; use the normal model")
    width = vol * math.sqrt(t)
    d1 = (math.log(forward / strike) + 0.5 * width * width) / width
    d2 = d1 - width
    return forward * N(d1) - strike * N(d2) if call else strike * N(-d2) - forward * N(-d1)


def bachelier(forward: float, strike: float, t: float, vol: float, call: bool) -> float:
    """Undiscounted Bachelier (normal) value; `vol` in absolute rate units (0.01 = 100bp)."""
    if t <= 0 or vol <= 0:
        return max((forward - strike) if call else (strike - forward), 0.0)
    width = vol * math.sqrt(t)
    d = (forward - strike) / width
    sign = 1 if call else -1
    return sign * (forward - strike) * N(sign * d) + width * n(d)


def option_value(
    model: VolModel, forward: float, strike: float, t: float, vol: float, call: bool
) -> float:
    return (black if model == "black" else bachelier)(forward, strike, t, vol, call)


def implied_vol(
    model: VolModel, value: float, forward: float, strike: float, t: float, call: bool
) -> float:
    """Invert an undiscounted option value for the model's volatility."""
    upper = 5.0 if model == "black" else 0.2
    return find_root(
        lambda v: option_value(model, forward, strike, t, v, call) - value, 1e-8, upper, xtol=1e-14
    )


@dataclass(frozen=True)
class CapFloor:
    strike: float
    maturity: float
    frequency: int = 4
    notional: float = 1_000_000.0
    cap: bool = True

    def caplets(
        self, curve: DiscountCurve, vol: float, model: VolModel = "black"
    ) -> list[dict[str, float]]:
        """Each caplet's fixing time, forward rate and value. The first period (fixing today) is
        excluded, as in market convention, because its rate is already known."""
        times = payment_times(0.0, self.maturity, self.frequency)
        tau = accruals(0.0, times)
        rows = []
        for i in range(1, len(times)):
            start, end = times[i - 1], times[i]
            forward = float(curve.forward_rate(start, end))
            value = (
                self.notional
                * tau[i]
                * curve.df(end)
                * option_value(model, forward, self.strike, start, vol, self.cap)
            )
            rows.append(
                {"fixing": float(start), "payment": float(end), "forward": forward, "value": value}
            )
        return rows

    def price(self, curve: DiscountCurve, vol: float, model: VolModel = "black") -> float:
        return sum(r["value"] for r in self.caplets(curve, vol, model))


@dataclass(frozen=True)
class Swaption:
    expiry: float
    tenor: float
    strike: float
    frequency: int = 1
    notional: float = 1_000_000.0
    payer: bool = True

    def schedule(self) -> tuple[np.ndarray, np.ndarray]:
        times = payment_times(self.expiry, self.expiry + self.tenor, self.frequency)
        return times, accruals(self.expiry, times)

    def annuity(self, curve: DiscountCurve) -> float:
        times, tau = self.schedule()
        return float((tau * curve.discount(times)).sum())

    def forward_swap_rate(self, curve: DiscountCurve) -> float:
        return (curve.df(self.expiry) - curve.df(self.expiry + self.tenor)) / self.annuity(curve)

    def price(self, curve: DiscountCurve, vol: float, model: VolModel = "black") -> float:
        forward = self.forward_swap_rate(curve)
        undiscounted = option_value(model, forward, self.strike, self.expiry, vol, self.payer)
        return self.notional * self.annuity(curve) * undiscounted
