import pytest

from derivlab import American, BlackScholes, European, Market, PlainVanilla


@pytest.mark.parametrize(
    "build",
    [
        lambda: Market(spot=0, rate=0.05),
        lambda: Market(spot=100, rate=float("nan")),
        lambda: BlackScholes(volatility=-0.1),
        lambda: PlainVanilla("call", strike=-1),
        lambda: PlainVanilla("straddle", strike=100),  # type: ignore[arg-type]
        lambda: European(expiry=-0.5),
        lambda: American(expiry=float("inf")),
    ],
)
def test_invalid_inputs_raise(build):
    with pytest.raises(ValueError):
        build()


def test_payoff_is_vectorised():
    call = PlainVanilla("call", 100)
    put = PlainVanilla("put", 100)
    assert call([90, 100, 120]).tolist() == [0, 0, 20]
    assert put([90, 100, 120]).tolist() == [10, 0, 0]
