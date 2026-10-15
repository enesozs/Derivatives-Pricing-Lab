import pytest

from derivlab import American, BlackScholes, European, Market, PlainVanilla, VanillaOption


@pytest.fixture
def market() -> Market:
    return Market(spot=100.0, rate=0.05)


@pytest.fixture
def model() -> BlackScholes:
    return BlackScholes(volatility=0.20)


def european(kind: str = "call", strike: float = 100.0, expiry: float = 1.0) -> VanillaOption:
    return VanillaOption(PlainVanilla(kind, strike), European(expiry))  # type: ignore[arg-type]


def american(kind: str = "put", strike: float = 100.0, expiry: float = 1.0) -> VanillaOption:
    return VanillaOption(PlainVanilla(kind, strike), American(expiry))  # type: ignore[arg-type]
