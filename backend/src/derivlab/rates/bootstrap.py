"""Bootstrapping: build a discount curve that reprices quoted instruments exactly.

Instruments are processed in maturity order; each adds one node whose discount factor is
solved so the instrument prices at par:
- Deposit (simple rate r to T): DF(T) = 1 / (1 + r T).
- FRA (simple rate r for [T1, T2]): DF(T2) = DF(T1) / (1 + r (T2 - T1)).
- Swap (par rate s, fixed frequency): fixed leg s * sum(tau_i DF(t_i)) must equal the floating
  leg 1 - DF(T_n) (single curve: projection and discounting on the same curve). DF(T_n) is
  found by root-finding because the intermediate DF(t_i) between the previous node and T_n
  depend on it through the interpolation.
Single-curve, as before 2008. Modern markets bootstrap a discounting curve (OIS/SOFR) and
separate projection curves per index; the mechanics are the same.
Reference: Hagan & West (2006), "Interpolation methods for curve construction"; Hull ch. 4, 7.
"""

from dataclasses import dataclass
from typing import Literal

from derivlab.core.roots import find_root

from .curve import DiscountCurve
from .schedule import accruals, payment_times


@dataclass(frozen=True)
class Quote:
    kind: Literal["deposit", "fra", "swap"]
    #: End of the instrument (years).
    maturity: float
    rate: float
    #: FRA start (years); ignored otherwise.
    start: float = 0.0
    #: Swap fixed-leg payments per year.
    frequency: int = 1

    @property
    def label(self) -> str:
        if self.kind == "fra":
            return f"FRA {_tenor(self.start)}×{_tenor(self.maturity)}"
        return f"{self.kind.capitalize()} {_tenor(self.maturity)}"


def _tenor(t: float) -> str:
    """Market tenor label: 1M, 6M, 2Y, 2.5Y."""
    months = round(t * 12)
    if t < 1 and abs(t * 12 - months) < 1e-6:
        return f"{months}M"
    return f"{t:g}Y"


def _swap_residual(curve: DiscountCurve, quote: Quote) -> float:
    times = payment_times(0.0, quote.maturity, quote.frequency)
    tau = accruals(0.0, times)
    annuity = float((tau * curve.discount(times)).sum())
    return quote.rate * annuity - (1 - curve.df(quote.maturity))


def bootstrap(quotes: list[Quote]) -> DiscountCurve:
    if not quotes:
        raise ValueError("need at least one quote")
    ordered = sorted(quotes, key=lambda q: q.maturity)
    if len({q.maturity for q in ordered}) != len(ordered):
        raise ValueError("each quote needs a distinct maturity")
    times: list[float] = []
    dfs: list[float] = []

    def curve_with(t: float, d: float) -> DiscountCurve:
        return DiscountCurve(tuple([*times, t]), tuple([*dfs, d]))

    for q in ordered:
        if q.kind == "deposit":
            d = 1 / (1 + q.rate * q.maturity)
        elif q.kind == "fra":
            if not times or q.start > times[-1] + 1e-12:
                raise ValueError(f"{q.label} starts beyond the curve built so far")
            d_start = DiscountCurve(tuple(times), tuple(dfs)).df(q.start) if q.start > 0 else 1.0
            d = d_start / (1 + q.rate * (q.maturity - q.start))
        else:
            d = find_root(
                lambda x, q=q: _swap_residual(curve_with(q.maturity, x), q), 1e-6, 1.5, 1e-15
            )
        times.append(q.maturity)
        dfs.append(float(d))
    return DiscountCurve(tuple(times), tuple(dfs))


def repricing_errors(curve: DiscountCurve, quotes: list[Quote]) -> list[float]:
    """Implied rate minus quoted rate for each input instrument (should be ~0)."""
    errors = []
    for q in quotes:
        if q.kind == "deposit":
            implied = (1 / curve.df(q.maturity) - 1) / q.maturity
        elif q.kind == "fra":
            implied = float(curve.forward_rate(q.start, q.maturity))
        else:
            times = payment_times(0.0, q.maturity, q.frequency)
            annuity = float((accruals(0.0, times) * curve.discount(times)).sum())
            implied = (1 - curve.df(q.maturity)) / annuity
        errors.append(implied - q.rate)
    return errors


#: An illustrative upward-sloping USD-style curve (not live market data).
SAMPLE_QUOTES: list[Quote] = [
    Quote("deposit", 1 / 12, 0.0430),
    Quote("deposit", 0.25, 0.0425),
    Quote("deposit", 0.5, 0.0415),
    Quote("swap", 1, 0.0400, frequency=1),
    Quote("swap", 2, 0.0380, frequency=1),
    Quote("swap", 3, 0.0372, frequency=1),
    Quote("swap", 5, 0.0370, frequency=1),
    Quote("swap", 7, 0.0375, frequency=1),
    Quote("swap", 10, 0.0385, frequency=1),
    Quote("swap", 15, 0.0398, frequency=1),
    Quote("swap", 20, 0.0402, frequency=1),
    Quote("swap", 30, 0.0395, frequency=1),
]
