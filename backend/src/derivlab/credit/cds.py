"""Credit default swaps and hazard-curve bootstrapping.

A CDS is insurance against a borrower's default. The protection buyer pays a running spread s
(quarterly, on the notional) until maturity or default; if the borrower defaults, the seller
pays the loss (1 - R) x notional, where R is the recovery rate.

  premium leg    = s x RPV01,
  RPV01          = sum_i tau_i DF(t_i) Q(t_i) + accrual on default
                   (half a period's premium on average, if default happens mid-period),
  protection leg = (1 - R) x E[DF(tau) 1{tau <= T}].

The par spread makes the two legs equal: s* = protection / RPV01. Integrals are evaluated
period by period at the midpoint (the "mid-point" engine, as in QuantLib's MidPointCdsEngine):
  protection ~ (1 - R) sum_i DF(mid_i) (Q(t_{i-1}) - Q(t_i)).

Since 2009 CDS trade with a fixed coupon (100bp or 500bp) plus an upfront payment:
  upfront = (s* - coupon) x RPV01.

**Bootstrapping** works exactly like the yield curve: quotes in maturity order, each adding a
hazard segment solved so that the quote prices at par.
Reference: O'Kane ch. 6-7; Hull ch. 25; ISDA CDS Standard Model documentation.
"""

from dataclasses import dataclass

from derivlab.core.roots import find_root
from derivlab.rates.curve import DiscountCurve
from derivlab.rates.schedule import accruals, payment_times

from .hazard import HazardCurve


@dataclass(frozen=True)
class CDS:
    maturity: float
    #: Running spread (0.01 = 100bp).
    spread: float
    recovery: float = 0.4
    frequency: int = 4
    notional: float = 1.0
    #: True = protection buyer (pays the spread, receives the loss).
    buyer: bool = True

    def __post_init__(self) -> None:
        if self.maturity <= 0 or not 1 <= self.frequency <= 12:
            raise ValueError("need maturity > 0 and 1 <= frequency <= 12")
        if not 0 <= self.recovery < 1:
            raise ValueError("recovery must be in [0, 1)")

    def legs(self, curve: DiscountCurve, hazard: HazardCurve) -> dict[str, float]:
        """Per unit notional: RPV01 (premium leg per unit spread) and the protection leg."""
        ends = payment_times(0.0, self.maturity, self.frequency)
        tau = accruals(0.0, ends)
        starts = ends - tau
        q_start, q_end = hazard.survival(starts), hazard.survival(ends)
        defaulted = q_start - q_end
        df_end = curve.discount(ends)
        df_mid = curve.discount(0.5 * (starts + ends))
        rpv01 = float((tau * df_end * q_end).sum() + (0.5 * tau * df_mid * defaulted).sum())
        protection = float((1 - self.recovery) * (df_mid * defaulted).sum())
        return {"rpv01": rpv01, "protection": protection}

    def par_spread(self, curve: DiscountCurve, hazard: HazardCurve) -> float:
        legs = self.legs(curve, hazard)
        return legs["protection"] / legs["rpv01"]

    def npv(self, curve: DiscountCurve, hazard: HazardCurve) -> float:
        legs = self.legs(curve, hazard)
        value = legs["protection"] - self.spread * legs["rpv01"]
        return self.notional * (value if self.buyer else -value)

    def upfront(self, curve: DiscountCurve, hazard: HazardCurve, coupon: float) -> float:
        """Upfront the protection buyer pays (per unit notional) to trade at `coupon`."""
        legs = self.legs(curve, hazard)
        return legs["protection"] - coupon * legs["rpv01"]


@dataclass(frozen=True)
class CDSQuote:
    maturity: float
    spread: float


def bootstrap_hazard(
    quotes: list[CDSQuote], curve: DiscountCurve, recovery: float = 0.4, frequency: int = 4
) -> HazardCurve:
    """Piecewise-flat hazard curve that reprices every par spread exactly."""
    ordered = sorted(quotes, key=lambda q: q.maturity)
    if len({q.maturity for q in ordered}) != len(ordered):
        raise ValueError("CDS quotes need distinct maturities")
    times: list[float] = []
    hazards: list[float] = []
    for q in ordered:
        if q.spread <= 0:
            raise ValueError("CDS spreads must be positive")
        cds = CDS(q.maturity, q.spread, recovery, frequency)

        def error(h: float, cds: CDS = cds, t: float = q.maturity) -> float:
            trial = HazardCurve((*times, t), (*hazards, h))
            return cds.par_spread(curve, trial) - cds.spread

        if error(1e-10) > 0:
            raise ValueError(
                f"{q.maturity:g}Y spread {q.spread * 1e4:.0f}bp is below what the shorter "
                "quotes already imply (it would need a negative hazard rate)"
            )
        hazards.append(find_root(error, 1e-10, 10.0, xtol=1e-14))
        times.append(q.maturity)
    return HazardCurve(tuple(times), tuple(hazards))


def repricing_errors(
    quotes: list[CDSQuote], curve: DiscountCurve, hazard: HazardCurve, recovery: float = 0.4
) -> list[float]:
    return [
        CDS(q.maturity, q.spread, recovery).par_spread(curve, hazard) - q.spread for q in quotes
    ]


#: Illustrative investment-grade-ish issuer: an upward-sloping spread curve (not live data).
SAMPLE_CDS_QUOTES = [
    CDSQuote(1, 0.0060),
    CDSQuote(2, 0.0075),
    CDSQuote(3, 0.0090),
    CDSQuote(5, 0.0115),
    CDSQuote(7, 0.0130),
    CDSQuote(10, 0.0140),
]
