"""Market data: raw option chains, bundled snapshots, synthetic chains and cleaning."""

from pathlib import Path

from .chain import ExpirySlice, OptionChain, OptionQuote, Source
from .cleaning import CleanSlice, SmilePoint, SurfaceData, clean_chain
from .synthetic import DEFAULT_HESTON, SyntheticSpec, synthetic_chain

SNAPSHOT_DIR = Path(__file__).parent / "snapshots"


def available_snapshots() -> list[str]:
    """Names of the bundled chain snapshots (file stems), newest first."""
    return sorted((p.stem for p in SNAPSHOT_DIR.glob("*.json")), reverse=True)


def load_snapshot(name: str) -> OptionChain:
    path = SNAPSHOT_DIR / f"{name}.json"
    if path.parent != SNAPSHOT_DIR or not path.is_file():
        raise ValueError(f"unknown snapshot {name!r}")
    return OptionChain.load(path, source="snapshot")


__all__ = [
    "DEFAULT_HESTON",
    "SNAPSHOT_DIR",
    "CleanSlice",
    "ExpirySlice",
    "OptionChain",
    "OptionQuote",
    "SmilePoint",
    "Source",
    "SurfaceData",
    "SyntheticSpec",
    "available_snapshots",
    "clean_chain",
    "load_snapshot",
    "synthetic_chain",
]
