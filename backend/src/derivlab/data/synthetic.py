"""Synthetic option chains generated from a known model. Clearly labelled; used for testing
calibration (we know the true parameters) and for working offline."""

from dataclasses import dataclass
from datetime import UTC, date, datetime, timedelta

import numpy as np

from derivlab.engines.fourier import cos_prices
from derivlab.market import Market
from derivlab.models import Heston

from .chain import ExpirySlice, OptionChain, OptionQuote

#: A typical equity-index parameter set: negative skew, mean-reverting variance.
DEFAULT_HESTON = Heston(v0=0.03, kappa=2.0, theta=0.045, xi=0.6, rho=-0.7)


@dataclass(frozen=True)
class SyntheticSpec:
    spot: float = 100.0
    rate: float = 0.04
    dividend_yield: float = 0.01
    model: Heston = DEFAULT_HESTON
    expiry_days: tuple[int, ...] = (14, 30, 60, 91, 182, 273, 365, 547, 730)
    #: Strikes as fractions of spot.
    moneyness: tuple[float, ...] = tuple(np.round(np.linspace(0.6, 1.4, 33), 4))
    #: Bid/ask half-spread as a fraction of the price (with a floor of 0.01).
    half_spread: float = 0.01
    #: Multiplicative noise added to mids, to mimic real quotes.
    noise: float = 0.002
    seed: int = 7


def synthetic_chain(spec: SyntheticSpec | None = None) -> OptionChain:
    spec = spec or SyntheticSpec()
    rng = np.random.default_rng(spec.seed)
    as_of = datetime(2026, 1, 2, 20, 0, tzinfo=UTC)
    market = Market(spec.spot, spec.rate, spec.dividend_yield)
    strikes = np.array(spec.moneyness) * spec.spot
    slices = []
    for days in spec.expiry_days:
        expiry = (as_of + timedelta(days=days)).date()
        t = days / 365
        quotes = []
        for kind in ("call", "put"):
            prices = cos_prices(kind, strikes, t, market, spec.model)  # type: ignore[arg-type]
            for strike, price in zip(strikes, prices, strict=True):
                mid = float(price) * (1 + spec.noise * rng.standard_normal())
                if mid < 0.01:
                    continue
                half = max(spec.half_spread * mid, 0.01)
                quotes.append(
                    OptionQuote(
                        kind=kind,  # type: ignore[arg-type]
                        strike=float(strike),
                        bid=round(max(mid - half, 0.0), 2),
                        ask=round(mid + half, 2),
                        last=round(mid, 2),
                        volume=100.0,
                        open_interest=1000.0,
                    )
                )
        slices.append(ExpirySlice(date.fromisoformat(expiry.isoformat()), tuple(quotes)))
    m = spec.model
    return OptionChain(
        ticker="SYNTH",
        spot=spec.spot,
        as_of=as_of,
        slices=tuple(slices),
        source="synthetic",
        description=(
            f"Synthetic Heston chain (v0={m.v0}, kappa={m.kappa}, theta={m.theta}, xi={m.xi}, "
            f"rho={m.rho}), r={spec.rate}, q={spec.dividend_yield}"
        ),
        synthetic=True,
    )
