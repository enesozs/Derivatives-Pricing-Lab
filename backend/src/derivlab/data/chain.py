"""Raw option-chain data, as quoted by an exchange or data vendor (before any cleaning)."""

import json
from dataclasses import asdict, dataclass, field
from datetime import UTC, date, datetime
from pathlib import Path
from typing import Literal

from derivlab.instruments import OptionKind

Source = Literal["yahoo", "snapshot", "synthetic"]


@dataclass(frozen=True)
class OptionQuote:
    kind: OptionKind
    strike: float
    bid: float | None
    ask: float | None
    last: float | None
    volume: float | None = None
    open_interest: float | None = None
    #: When `last` traded (ISO-8601, UTC); None if unknown.
    last_trade: str | None = None

    @property
    def mid(self) -> float | None:
        if self.bid and self.ask and self.bid > 0 and self.ask >= self.bid:
            return 0.5 * (self.bid + self.ask)
        return None


@dataclass(frozen=True)
class ExpirySlice:
    expiry: date
    quotes: tuple[OptionQuote, ...]


@dataclass(frozen=True)
class OptionChain:
    ticker: str
    spot: float
    #: Valuation time: when the quotes were (last) valid, UTC.
    as_of: datetime
    slices: tuple[ExpirySlice, ...]
    source: Source
    #: Free-text provenance, e.g. "Yahoo Finance last trades, market closed".
    description: str = ""
    #: True for model-generated data; the UI must label it as synthetic.
    synthetic: bool = field(default=False)

    def year_fraction(self, expiry: date) -> float:
        """ACT/365 time from `as_of` to 16:00 New York (~20:00 UTC) on the expiry date."""
        expiry_time = datetime(expiry.year, expiry.month, expiry.day, 20, 0, tzinfo=UTC)
        return max((expiry_time - self.as_of).total_seconds(), 0.0) / (365 * 24 * 3600)

    # --- persistence -------------------------------------------------------------------------

    def to_json(self) -> str:
        payload = {
            "ticker": self.ticker,
            "spot": self.spot,
            "as_of": self.as_of.isoformat(),
            "source": self.source,
            "description": self.description,
            "synthetic": self.synthetic,
            "slices": [
                {"expiry": s.expiry.isoformat(), "quotes": [asdict(q) for q in s.quotes]}
                for s in self.slices
            ],
        }
        return json.dumps(payload, separators=(",", ":"))

    @staticmethod
    def from_json(text: str, source: Source | None = None) -> "OptionChain":
        raw = json.loads(text)
        slices = tuple(
            ExpirySlice(
                date.fromisoformat(s["expiry"]), tuple(OptionQuote(**q) for q in s["quotes"])
            )
            for s in raw["slices"]
        )
        return OptionChain(
            ticker=raw["ticker"],
            spot=float(raw["spot"]),
            as_of=datetime.fromisoformat(raw["as_of"]),
            slices=slices,
            source=source or raw["source"],
            description=raw.get("description", ""),
            synthetic=bool(raw.get("synthetic", False)),
        )

    def save(self, path: Path) -> None:
        path.write_text(self.to_json())

    @staticmethod
    def load(path: Path, source: Source | None = None) -> "OptionChain":
        return OptionChain.from_json(path.read_text(), source)
