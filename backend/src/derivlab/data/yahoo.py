"""Option chains from Yahoo Finance (via yfinance). Free, delayed, and sometimes stale.

Yahoo quotes bid/ask only while the market is open; outside trading hours they are zero and
only the last trade price is usable. Cleaning (data/cleaning.py) handles both cases and records
which one it used. Network access is required; tests use bundled snapshots instead.
"""

import math
from datetime import UTC, date, datetime

from .chain import ExpirySlice, OptionChain, OptionQuote


def _number(value: object) -> float | None:
    try:
        x = float(value)  # type: ignore[arg-type]
    except (TypeError, ValueError):
        return None
    return x if math.isfinite(x) else None


def _pick_expiries(
    expiries: list[date], as_of: date, max_expiries: int, min_days: int
) -> list[date]:
    """Spread the chosen expiries over the term structure instead of taking the first few."""
    eligible = [e for e in expiries if (e - as_of).days >= min_days]
    if len(eligible) <= max_expiries:
        return eligible
    chosen: list[date] = []
    # Log-spaced targets between the first and last available maturity.
    first, last = (eligible[0] - as_of).days, (eligible[-1] - as_of).days
    for i in range(max_expiries):
        target = first * (last / first) ** (i / (max_expiries - 1))
        best = min(eligible, key=lambda e: abs((e - as_of).days - target))
        if best not in chosen:
            chosen.append(best)
    return sorted(chosen)


def fetch_chain(
    ticker: str,
    max_expiries: int = 10,
    min_days: int = 5,
    moneyness: tuple[float, float] = (0.6, 1.4),
) -> OptionChain:
    """Download a chain for `ticker`: up to `max_expiries` expiries, strikes within `moneyness`."""
    import yfinance as yf  # imported lazily: only needed for live data

    tk = yf.Ticker(ticker)
    history = tk.history(period="5d")
    if history.empty:
        raise ValueError(f"no price history for {ticker!r}")
    spot = float(history["Close"].iloc[-1])
    expiries = [date.fromisoformat(e) for e in tk.options]
    if not expiries:
        raise ValueError(f"{ticker!r} has no listed options on Yahoo Finance")

    slices = []
    latest_trade: datetime | None = None
    quoted = total = 0
    low, high = moneyness[0] * spot, moneyness[1] * spot
    for expiry in _pick_expiries(expiries, datetime.now(UTC).date(), max_expiries, min_days):
        chain = tk.option_chain(expiry.isoformat())
        quotes = []
        for kind, frame in (("call", chain.calls), ("put", chain.puts)):
            for row in frame.itertuples():
                strike = _number(row.strike)
                if strike is None or not low <= strike <= high:
                    continue
                trade = getattr(row, "lastTradeDate", None)
                trade_time = trade.to_pydatetime().astimezone(UTC) if trade is not None else None
                if trade_time and (latest_trade is None or trade_time > latest_trade):
                    latest_trade = trade_time
                bid, ask = _number(row.bid), _number(row.ask)
                quoted += bool(bid and bid > 0)
                total += 1
                quotes.append(
                    OptionQuote(
                        kind=kind,  # type: ignore[arg-type]
                        strike=strike,
                        bid=bid,
                        ask=ask,
                        last=_number(row.lastPrice),
                        volume=_number(row.volume),
                        open_interest=_number(row.openInterest),
                        last_trade=trade_time.isoformat() if trade_time else None,
                    )
                )
        slices.append(ExpirySlice(expiry, tuple(quotes)))

    # Outside trading hours only a few stray bids exist: value the chain at the last trade,
    # because that is when most of its prices were set.
    live = total > 0 and quoted / total > 0.5
    as_of = datetime.now(UTC) if live or latest_trade is None else latest_trade
    description = (
        "Yahoo Finance bid/ask (delayed)"
        if live
        else "Yahoo Finance last-trade prices (market closed)"
    )
    return OptionChain(ticker.upper(), spot, as_of, tuple(slices), "yahoo", description)
