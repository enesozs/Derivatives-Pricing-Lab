"""From raw quotes to an implied-volatility smile per expiry.

For each expiry:
1. **Price each quote**: the bid/ask mid when the spread is reasonable, otherwise a recent last
   trade (outside market hours that is all Yahoo provides). Stale, missing or wide quotes are
   dropped, and every drop is counted by reason.
2. **Forward (and discount factor) from put–call parity.** C - P = D (F - K) holds for European
   options whatever the model. With `estimate_rate=True`, regressing C - P on K over
   near-the-money strikes gives both D (minus the slope) and F, so neither rates nor dividends
   need guessing. For American options parity is only an inequality: in-the-money puts carry
   an early-exercise premium that bends the regression and implies rates near zero. So by
   default D comes from `rate` and only F = K + (C - P)/D is estimated, as a robust median.
   Fits use robust losses because last-trade prices are asynchronous.
3. **Keep out-of-the-money options**: puts below the forward, calls above. They are the liquid
   ones, and in-the-money prices add nothing that parity doesn't already give. Options more than
   `max_std` standard deviations out of the money (|k| > max_std * sigma_ATM * sqrt(T)) are
   dropped: they cost a few cents, so tick size and stale trades swamp their information.
4. **Implied volatility** of each price with Black–Scholes on the forward (Black-76).

Caveat: US single-stock and ETF options (e.g. SPY) are American. For out-of-the-money options
the early-exercise premium is tiny, so treating them as European is standard practice; index
options such as SPX are European.
"""

import math
from collections import Counter
from dataclasses import dataclass, field
from datetime import date, datetime
from typing import Literal

import numpy as np
from scipy.optimize import least_squares

from derivlab.calibration.implied_vol import implied_volatility
from derivlab.instruments import European, OptionKind, PlainVanilla, VanillaOption
from derivlab.market import Market

from .chain import OptionChain, OptionQuote, Source

PriceSource = Literal["mid", "last"]


@dataclass(frozen=True)
class SmilePoint:
    strike: float
    #: ln(K / F)
    log_moneyness: float
    implied_vol: float
    price: float
    kind: OptionKind
    price_source: PriceSource


@dataclass(frozen=True)
class CleanSlice:
    expiry: date
    t: float
    forward: float
    discount: float
    forward_method: Literal["parity", "fallback"]
    points: tuple[SmilePoint, ...]
    dropped: dict[str, int] = field(default_factory=dict)

    @property
    def rate(self) -> float:
        """Continuously compounded rate implied by the discount factor."""
        return -math.log(self.discount) / self.t

    @property
    def market(self) -> Market:
        """A market whose forward and discounting match this slice (spot = forward, q = r)."""
        return Market(self.forward, self.rate, self.rate)

    @property
    def atm_vol(self) -> float:
        """Implied volatility at the forward, interpolated linearly in log-moneyness."""
        ks = np.array([p.log_moneyness for p in self.points])
        vols = np.array([p.implied_vol for p in self.points])
        return float(np.interp(0.0, ks, vols))


@dataclass(frozen=True)
class SurfaceData:
    ticker: str
    spot: float
    as_of: datetime
    source: Source
    description: str
    synthetic: bool
    slices: tuple[CleanSlice, ...]
    price_basis: Literal["mid", "last", "mixed"]


def _quote_price(
    quote: OptionQuote, as_of: datetime, max_relative_spread: float, max_stale_days: float
) -> tuple[float, PriceSource] | str:
    """A usable price and where it came from, or the reason the quote is dropped."""
    mid = quote.mid
    if mid is not None and quote.ask is not None and quote.bid is not None:
        if (quote.ask - quote.bid) / mid <= max_relative_spread:
            return mid, "mid"
        return "wide spread"
    if quote.last is None or quote.last <= 0:
        return "no price"
    if quote.last_trade:
        age = (as_of - datetime.fromisoformat(quote.last_trade)).total_seconds() / 86400
        if age > max_stale_days:
            return "stale last trade"
    return quote.last, "last"


def _parity_fit(
    pairs: list[tuple[float, float]],
    t: float,
    spot: float,
    fallback_rate: float,
    estimate_rate: bool,
) -> tuple[float, float, Literal["parity", "fallback"]]:
    """(forward, discount, method) from (strike, call - put) pairs.

    "parity" means the forward came from the quotes; "fallback" means it had to be assumed.
    """
    fallback_discount = math.exp(-fallback_rate * t)
    if estimate_rate and len(pairs) >= 3:
        strikes = np.array([k for k, _ in pairs])
        diffs = np.array([d for _, d in pairs])

        def residuals(p: np.ndarray) -> np.ndarray:
            discount, forward = p
            return (discount * (forward - strikes) - diffs) / spot

        fit = least_squares(residuals, x0=[fallback_discount, spot], loss="soft_l1", f_scale=0.002)
        discount, forward = (float(v) for v in fit.x)
        rate = -math.log(discount) / t if discount > 0 else float("inf")
        if -0.02 <= rate <= 0.15 and 0.8 < forward / spot < 1.25:
            return forward, discount, "parity"
    if pairs:
        forward = float(np.median([d / fallback_discount + k for k, d in pairs]))
        if 0.8 < forward / spot < 1.25:
            return forward, fallback_discount, "parity"
    return spot * math.exp(fallback_rate * t), fallback_discount, "fallback"


def clean_chain(
    chain: OptionChain,
    rate: float = 0.04,
    estimate_rate: bool = False,
    max_relative_spread: float = 0.5,
    max_stale_days: float = 1.0,
    min_price: float = 0.05,
    parity_window: float = 0.1,
    min_points: int = 5,
    max_std: float = 4.0,
) -> SurfaceData:
    slices = []
    sources: set[PriceSource] = set()
    for raw in chain.slices:
        t = chain.year_fraction(raw.expiry)
        if t < 2 / 365:
            continue
        dropped: Counter[str] = Counter()
        priced: dict[tuple[str, float], tuple[float, PriceSource]] = {}
        for quote in raw.quotes:
            result = _quote_price(quote, chain.as_of, max_relative_spread, max_stale_days)
            if isinstance(result, str):
                dropped[result] += 1
            else:
                priced[(quote.kind, quote.strike)] = result

        strikes = sorted({k for _, k in priced})
        pairs = [
            (k, priced[("call", k)][0] - priced[("put", k)][0])
            for k in strikes
            if ("call", k) in priced
            and ("put", k) in priced
            and abs(k / chain.spot - 1) <= parity_window
        ]
        if len(pairs) < 3:
            pairs = [
                (k, priced[("call", k)][0] - priced[("put", k)][0])
                for k in strikes
                if ("call", k) in priced
                and ("put", k) in priced
                and abs(k / chain.spot - 1) <= 0.25
            ]
        forward, discount, method = _parity_fit(pairs, t, chain.spot, rate, estimate_rate)
        slice_rate = -math.log(discount) / t
        market = Market(forward, slice_rate, slice_rate)

        points = []
        for k in strikes:
            kind: OptionKind = "put" if k < forward else "call"
            if (kind, k) not in priced:
                dropped["in the money side only"] += 1
                continue
            price, source = priced[(kind, k)]
            if price < min_price:
                dropped["below minimum price"] += 1
                continue
            option = VanillaOption(PlainVanilla(kind, k), European(t))
            try:
                vol = implied_volatility(price, option, market).volatility
            except ValueError:
                dropped["no implied volatility"] += 1
                continue
            if not 0.01 <= vol <= 3.0:
                dropped["implausible volatility"] += 1
                continue
            points.append(SmilePoint(k, math.log(k / forward), vol, price, kind, source))
        if points:
            # Trim the far wings relative to this expiry's own at-the-money volatility.
            ks = np.array([p.log_moneyness for p in points])
            atm = float(np.interp(0.0, ks, [p.implied_vol for p in points]))
            limit = max_std * atm * math.sqrt(t)
            kept = [p for p in points if abs(p.log_moneyness) <= limit]
            if len(kept) < len(points):
                dropped["far out of the money"] += len(points) - len(kept)
            points = kept
        if len(points) >= min_points:
            sources.update(p.price_source for p in points)
            slices.append(
                CleanSlice(raw.expiry, t, forward, discount, method, tuple(points), dict(dropped))
            )

    if not slices:
        raise ValueError("no expiry had enough clean quotes to build a smile")
    basis: Literal["mid", "last", "mixed"] = (
        "mixed" if len(sources) > 1 else ("mid" if "mid" in sources else "last")
    )
    return SurfaceData(
        chain.ticker,
        chain.spot,
        chain.as_of,
        chain.source,
        chain.description,
        chain.synthetic,
        tuple(slices),
        basis,
    )
