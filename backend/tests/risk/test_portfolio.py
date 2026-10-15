import pytest

from derivlab import (
    AnalyticEngine,
    BlackScholes,
    European,
    Heston,
    Market,
    PlainVanilla,
    VanillaOption,
)
from derivlab.risk import Position, Scenario, portfolio_risk, revalue, scenario_report, stress_grid
from derivlab.structured import Autocallable, ReverseConvertible

MARKET = Market(100.0, 0.03, 0.01)
BS = BlackScholes(0.25)


def call(strike: float) -> VanillaOption:
    return VanillaOption(PlainVanilla("call", strike), European(1.0))


def test_greeks_of_a_vanilla_book_match_black_scholes():
    options = [call(100), call(110)]
    book = [Position(options[0], 10.0), Position(options[1], -5.0)]
    risk = portfolio_risk(book, MARKET, BS)
    greeks = [AnalyticEngine().price(o, MARKET, BS).greeks for o in options]
    delta = sum(p.quantity * g.delta for p, g in zip(book, greeks, strict=True) if g)
    gamma = sum(p.quantity * g.gamma for p, g in zip(book, greeks, strict=True) if g)
    vega = sum(p.quantity * g.vega for p, g in zip(book, greeks, strict=True) if g)
    assert risk.delta.sum() == pytest.approx(delta, rel=1e-3)
    assert risk.gamma.sum() == pytest.approx(gamma, rel=1e-3)
    assert risk.vega.sum() == pytest.approx(vega / 100, rel=1e-3)


def test_taylor_estimate_is_good_for_small_moves_only():
    book = [Position(call(100), 100.0), Position(ReverseConvertible(barrier=0.7), -10_000)]
    report = {
        r.name: r
        for r in scenario_report(
            book, MARKET, BS, (Scenario("small", 0.01), Scenario("crash", -0.3, 0.2))
        )
    }
    small, crash = report["small"], report["crash"]
    assert small.taylor == pytest.approx(small.full, rel=0.02)
    assert abs(crash.taylor - crash.full) > 0.05 * abs(crash.full)


def test_issuer_of_notes_is_long_volatility_and_gains_in_a_crash():
    book = [Position(Autocallable(), -1_000_000), Position(ReverseConvertible(), -1_000_000)]
    risk = portfolio_risk(book, MARKET, BS)
    assert risk.vega.sum() > 0 and risk.delta.sum() < 0
    grid = stress_grid(book, MARKET, BS, [-0.2, 0.0, 0.2], [0.0])
    assert grid[0, 1] == pytest.approx(0.0, abs=1e-6)
    assert grid[0, 0] > 0 > grid[0, 2]


def test_notes_keep_their_initial_fixing_under_shocks():
    note = Position(ReverseConvertible(), 1.0)
    base = revalue([note], MARKET, BS)[0]
    down = revalue([note], MARKET, BS, Scenario("down", -0.2))[0]
    assert down < base - 0.1  # the put moved 20 points into the money


def test_heston_vol_shock_moves_both_variance_levels():
    from derivlab.risk import shock

    model = Heston(v0=0.04, kappa=1.5, theta=0.09, xi=0.5, rho=-0.6)
    _, bumped = shock(MARKET, model, Scenario("vol", vol=0.05))
    assert isinstance(bumped, Heston)
    assert bumped.v0 == pytest.approx(0.25**2) and bumped.theta == pytest.approx(0.35**2)
