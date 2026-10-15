import pytest

from derivlab import (
    BinomialEngine,
    BlackScholes,
    CosEngine,
    Heston,
    LongstaffSchwartzEngine,
    Market,
    UnsupportedError,
)
from derivlab.engines.montecarlo import longstaff_schwartz
from derivlab.instruments import DigitalOption
from tests.conftest import american, european


@pytest.mark.parametrize("strike", [90.0, 100.0, 110.0])
def test_american_put_close_to_tree(strike, market, model):
    option = american("put", strike)
    tree = BinomialEngine(2001, "leisen-reimer", greeks=False).price(option, market, model).value
    lsm = LongstaffSchwartzEngine(paths=40_000).price(option, market, model)
    # 50 exercise dates (Bermudan) and an imperfect regression sit slightly below the American.
    assert lsm.value == pytest.approx(tree, abs=0.05)


def test_european_limit_with_one_exercise_date(market, model):
    from derivlab import AnalyticEngine

    exact = AnalyticEngine().price(european("put"), market, model).value
    lsm = LongstaffSchwartzEngine(paths=40_000, exercise_dates=1).price(
        american("put"), market, model
    )
    assert lsm.stderr is not None and abs(lsm.value - exact) < 4 * lsm.stderr


def test_american_under_heston_exceeds_european():
    market = Market(100, 0.05)
    heston = Heston(0.04, 1.5, 0.04, 0.5, -0.7)
    eu = CosEngine().price(european("put"), market, heston).value
    am = LongstaffSchwartzEngine(paths=20_000).price(american("put"), market, heston).value
    assert am > eu


def test_boundary_below_strike_for_put(market, model):
    result = longstaff_schwartz(american("put"), market, model, paths=20_000, exercise_dates=20)
    boundary = result.boundary[~(result.boundary != result.boundary)]  # drop NaN
    assert len(boundary) > 5 and (boundary <= 100 + 1e-9).all()
    assert result.exercise_points.shape[1] == 2


def test_only_vanillas(market):
    with pytest.raises(UnsupportedError):
        LongstaffSchwartzEngine().price(DigitalOption("call", 100, 1.0), market, BlackScholes(0.2))
