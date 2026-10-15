import math

import numpy as np
import pytest

from derivlab.calibration import implied_volatility
from derivlab.data import (
    DEFAULT_HESTON,
    OptionChain,
    SyntheticSpec,
    available_snapshots,
    clean_chain,
    load_snapshot,
    synthetic_chain,
)
from derivlab.engines.fourier import cos_prices
from derivlab.instruments import European, PlainVanilla, VanillaOption


@pytest.fixture(scope="module")
def synthetic():
    return clean_chain(synthetic_chain())


def test_json_round_trip():
    chain = synthetic_chain()
    again = OptionChain.from_json(chain.to_json())
    assert again == chain


def test_synthetic_is_labelled(synthetic):
    assert synthetic.synthetic and synthetic.source == "synthetic"
    assert synthetic.price_basis == "mid"


def test_forwards_recovered_from_parity(synthetic):
    spec = SyntheticSpec()
    for sl in synthetic.slices:
        true_forward = spec.spot * math.exp((spec.rate - spec.dividend_yield) * sl.t)
        assert sl.forward == pytest.approx(true_forward, rel=5e-4)
        assert sl.forward_method == "parity"


def test_rate_estimation_on_european_data():
    data = clean_chain(synthetic_chain(), estimate_rate=True)
    long_dated = [sl for sl in data.slices if sl.t >= 0.5]
    assert all(sl.rate == pytest.approx(0.04, abs=0.005) for sl in long_dated)


def test_implied_vols_match_the_generating_model(synthetic):
    sl = synthetic.slices[-3]
    spec = SyntheticSpec()
    from derivlab.market import Market

    market = Market(spec.spot, spec.rate, spec.dividend_yield)
    for point in sl.points[::5]:
        model_price = cos_prices(point.kind, [point.strike], sl.t, market, DEFAULT_HESTON)[0]
        option = VanillaOption(PlainVanilla(point.kind, point.strike), European(sl.t))
        model_vol = implied_volatility(model_price, option, market).volatility
        assert point.implied_vol == pytest.approx(model_vol, abs=0.005)  # quotes carry noise


def test_only_out_of_the_money_options_are_kept(synthetic):
    for sl in synthetic.slices:
        for p in sl.points:
            assert (p.kind == "put") == (p.strike < sl.forward)


def test_far_wings_are_trimmed():
    data = clean_chain(synthetic_chain(), max_std=1.0)
    assert any(sl.dropped.get("far out of the money") for sl in data.slices)
    for sl in data.slices:
        limit = sl.atm_vol * math.sqrt(sl.t) * 1.0
        assert max(abs(p.log_moneyness) for p in sl.points) <= limit + 0.05


def test_bundled_spy_snapshot_cleans_to_a_sensible_smile():
    names = available_snapshots()
    assert names, "a snapshot should be bundled"
    chain = load_snapshot(names[0])
    assert chain.source == "snapshot" and not chain.synthetic
    data = clean_chain(chain)
    assert len(data.slices) >= 5
    atm = np.array([sl.atm_vol for sl in data.slices])
    assert np.all((atm > 0.05) & (atm < 0.6))
    # Equity skew: low strikes have higher implied volatility than high strikes.
    sl = data.slices[len(data.slices) // 2]
    assert sl.points[0].implied_vol > sl.points[-1].implied_vol


def test_unknown_snapshot_rejected():
    with pytest.raises(ValueError):
        load_snapshot("../../etc/passwd")
