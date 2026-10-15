import math

import numpy as np
import pytest

from derivlab import (
    AnalyticEngine,
    BlackScholes,
    European,
    Heston,
    Market,
    Merton,
    PlainVanilla,
    VanillaOption,
)
from derivlab.engines.analytic.black_scholes import black_scholes
from derivlab.multi_asset.market import CorrelatedBlackScholes, MultiAssetMarket
from derivlab.structured import (
    Autocallable,
    Cliquet,
    ForwardStartOption,
    ReverseConvertible,
    barrier_hit_probability,
    cliquet_black_scholes,
    expected_variance,
    forward_start_black_scholes,
    forward_start_monte_carlo,
    price_autocallable,
    price_cliquet,
    price_worst_of_autocallable,
    replicate_variance,
    simulate_realised_variance,
)

MARKET = Market(100.0, 0.03, 0.01)
BS = BlackScholes(0.25)
HESTON = Heston(v0=0.0625, kappa=1.5, theta=0.0625, xi=0.6, rho=-0.7)


def put(strike: float, t: float, market: Market = MARKET, vol: float = 0.25) -> float:
    option = VanillaOption(PlainVanilla("put", strike), European(t))
    return AnalyticEngine().price(option, market, BlackScholes(vol)).value


# --- autocallables ---------------------------------------------------------------------------


def test_autocallable_redeems_at_first_date_without_volatility():
    note = Autocallable(maturity=2, frequency=4, coupon=0.08)
    result = price_autocallable(note, MARKET, BlackScholes(1e-8), paths=2_000)
    df = math.exp(-0.03 * 0.25)
    assert result.value == pytest.approx(df * (1 + 0.02), rel=1e-9)
    assert result.redemption_probabilities[0] == pytest.approx(1.0)
    assert result.expected_life == pytest.approx(0.25)


def test_autocallable_reduces_to_bond_minus_put_and_digital():
    """No autocall and no coupons: redemption 1 - (1 - W) 1{W < B} at maturity, i.e.
    DF - put(B)/S0 - (1 - B) DF P(W < B)."""
    b, t = 0.6, 2.0
    note = Autocallable(
        maturity=t, frequency=1, coupon=0.0, autocall_level=1e6, protection_barrier=b
    )
    result = price_autocallable(note, MARKET, BS, paths=200_000)
    df = math.exp(-0.03 * t)
    d2 = (math.log(1 / b) + (0.03 - 0.01 - 0.5 * 0.25**2) * t) / (0.25 * math.sqrt(t))
    from derivlab.core.stats import norm_cdf

    exact = df - put(b * 100, t) / 100 - (1 - b) * df * norm_cdf(-d2)
    assert result.value == pytest.approx(exact, abs=4 * result.stderr)


def test_fair_coupon_prices_at_par():
    note = Autocallable(coupon=0.05)
    first = price_autocallable(note, MARKET, BS, paths=20_000, seed=3)
    fair = Autocallable(coupon=first.fair_coupon)
    assert price_autocallable(fair, MARKET, BS, paths=20_000, seed=3).value == pytest.approx(1.0)


def test_autocallable_risks_have_the_right_sign():
    base = price_autocallable(Autocallable(), MARKET, BS, seed=5).value
    # Short volatility: more volatility, lower value.
    assert price_autocallable(Autocallable(), MARKET, BlackScholes(0.35), seed=5).value < base
    # Daily monitoring of the protection barrier can only add losses.
    daily = price_autocallable(Autocallable(monitoring="daily"), MARKET, BS, seed=5).value
    assert daily < base
    # Memory can only add coupons.
    no_memory = price_autocallable(Autocallable(memory=False), MARKET, BS, seed=5).value
    assert no_memory < base
    assert sum(price_autocallable(Autocallable(), MARKET, BS).redemption_probabilities) == (
        pytest.approx(1.0)
    )


def test_worst_of_needs_more_coupon_and_likes_correlation():
    market = MultiAssetMarket((100.0, 100.0, 100.0), 0.03, (0.01, 0.01, 0.01))
    note = Autocallable()

    def fair(rho: float) -> float:
        model = CorrelatedBlackScholes.uniform((0.25,) * 3, rho)
        return price_worst_of_autocallable(note, market, model, seed=9).fair_coupon

    single = price_autocallable(note, MARKET, BS, seed=9).fair_coupon
    assert fair(0.2) > fair(0.6) > fair(0.95) > single * 0.97
    # Perfectly correlated identical assets behave like one asset.
    assert fair(0.999) == pytest.approx(single, rel=0.05)


def test_autocallable_under_heston_is_close_to_black_scholes():
    bs = price_autocallable(Autocallable(), MARKET, BS).value
    heston = price_autocallable(Autocallable(), MARKET, HESTON).value
    assert abs(heston - bs) < 0.05


def test_autocallable_validation():
    with pytest.raises(ValueError):
        Autocallable(maturity=1.1, frequency=4)
    with pytest.raises(ValueError):
        Autocallable(non_call_periods=12, maturity=3, frequency=4)


# --- reverse convertibles --------------------------------------------------------------------


def test_reverse_convertible_decomposition():
    note = ReverseConvertible(maturity=1, coupon=0.1, frequency=4, strike=1.0)
    d = note.decompose(MARKET, BS)
    annuity = sum(math.exp(-0.03 * t) for t in (0.25, 0.5, 0.75, 1.0)) / 4
    assert d["coupons"] == pytest.approx(0.1 * annuity)
    assert d["short_put"] == pytest.approx(-put(100, 1) / 100)
    assert d["value"] == pytest.approx(d["bond"] + d["coupons"] + d["short_put"])
    fair = ReverseConvertible(coupon=d["fair_coupon"])
    assert fair.value(MARKET, BS) == pytest.approx(1.0)


def test_barrier_makes_the_note_safer_and_the_coupon_lower():
    plain = ReverseConvertible().decompose(MARKET, BS)
    barrier = ReverseConvertible(barrier=0.7).decompose(MARKET, BS)
    assert barrier["fair_coupon"] < plain["fair_coupon"]
    # Barrier at the strike: knock-in is certain whenever the put pays, so same value.
    at_strike = ReverseConvertible(barrier=1.0).decompose(MARKET, BS)
    assert at_strike["value"] == pytest.approx(plain["value"], abs=1e-9)


def test_reverse_convertible_after_a_crash_through_the_barrier():
    note = ReverseConvertible(barrier=0.7)
    crashed = Market(60.0, 0.03, 0.01)
    value = note.value(crashed, BS, reference=100.0)
    # Knocked in: converts into 1/100 shares per unit; the put is plain and deep in the money.
    expected = note.decompose(crashed, BS, 100.0)
    assert value == pytest.approx(expected["value"])
    assert value < 0.75


def test_barrier_hit_probability_matches_simulation():
    note = ReverseConvertible(maturity=1, barrier=0.8)
    rng = np.random.default_rng(1)
    steps, n = 2_000, 20_000
    dt = 1 / steps
    z = rng.standard_normal((n, steps))
    log_s = np.cumsum((0.03 - 0.01 - 0.5 * 0.0625) * dt + 0.25 * math.sqrt(dt) * z, axis=1)
    simulated = float((log_s.min(axis=1) < math.log(0.8)).mean())
    # Discrete monitoring slightly under-counts touches.
    assert simulated == pytest.approx(barrier_hit_probability(note, MARKET, BS), abs=0.015)


# --- variance swaps --------------------------------------------------------------------------


@pytest.mark.parametrize("model", [BS, HESTON])
def test_replication_converges_to_expected_variance(model):
    exact = expected_variance(model, 1.0)
    coarse = replicate_variance(MARKET, model, 1.0, n_strikes=61).strike
    fine = replicate_variance(MARKET, model, 1.0, n_strikes=1001, width=10).strike
    assert fine == pytest.approx(exact, rel=1e-4)
    assert abs(coarse - exact) > abs(fine - exact)  # discretisation error shrinks


def test_jumps_break_the_replication_identity():
    model = Merton(volatility=0.2, intensity=0.5, jump_mean=-0.1, jump_volatility=0.15)
    replicated = replicate_variance(MARKET, model, 1.0, n_strikes=1001, width=10).strike
    m, d = model.jump_mean, model.jump_volatility
    # Log contract: 2 lambda E[e^J - 1 - J] per year instead of lambda E[J^2].
    predicted = model.volatility**2 + 2 * model.intensity * (math.exp(m + 0.5 * d * d) - 1 - m)
    assert replicated == pytest.approx(predicted, rel=1e-3)
    assert replicated < expected_variance(model, 1.0)


def test_heston_expected_variance_formula():
    assert expected_variance(HESTON, 2.0) == pytest.approx(0.0625)
    rising = Heston(v0=0.04, kappa=2.0, theta=0.09, xi=0.5, rho=-0.5)
    t = 1.5
    integral = 0.09 * t + (0.04 - 0.09) * (1 - math.exp(-2 * t)) / 2
    assert expected_variance(rising, t) == pytest.approx(integral / t)


def test_realised_variance_and_convexity():
    rv = simulate_realised_variance(MARKET, HESTON, 1.0, paths=20_000)
    assert rv.fair_variance == pytest.approx(0.0625, abs=4 * rv.fair_variance_stderr + 1e-3)
    assert rv.convexity_adjustment > 0.005  # vol of vol makes sqrt(E var) > E vol
    bs = simulate_realised_variance(MARKET, BS, 1.0, paths=20_000)
    assert bs.fair_variance == pytest.approx(0.0625, abs=4 * bs.fair_variance_stderr)
    assert bs.convexity_adjustment < 0.002  # only sampling noise with constant volatility


# --- forward-start and cliquets --------------------------------------------------------------


def test_forward_start_from_today_is_a_vanilla():
    option = ForwardStartOption(0.0, 1.0, moneyness=1.1)
    assert forward_start_black_scholes(option, MARKET, BS) == pytest.approx(
        black_scholes(100, 110, 1.0, 0.03, 0.01, 0.25, 1)[0]
    )


def test_forward_start_monte_carlo_matches_closed_form():
    option = ForwardStartOption(1.0, 2.0)
    exact = forward_start_black_scholes(option, MARKET, BS)
    value, stderr = forward_start_monte_carlo(option, MARKET, BS, paths=100_000)
    assert value == pytest.approx(exact, abs=4 * stderr)


def test_cliquet_closed_form_matches_monte_carlo():
    cliquet = Cliquet(maturity=3, periods=12, local_floor=-0.02, local_cap=0.03, global_floor=None)
    exact = cliquet_black_scholes(cliquet, MARKET, BS)
    assert exact is not None
    mc = price_cliquet(cliquet, MARKET, BS, paths=100_000)
    assert mc.value == pytest.approx(exact, abs=4 * mc.stderr)


def test_cliquet_global_floor_and_caps():
    no_floor = Cliquet(local_floor=-0.05, global_floor=None)
    floored = Cliquet(local_floor=-0.05, global_floor=0.0)
    assert floored.global_bounds_bind and cliquet_black_scholes(floored, MARKET, BS) is None
    v0 = price_cliquet(no_floor, MARKET, BS, seed=4).value
    v1 = price_cliquet(floored, MARKET, BS, seed=4).value
    assert v1 > v0  # the floor is a put on the sum
    # A higher local cap is worth more.
    low = cliquet_black_scholes(Cliquet(local_cap=0.02, global_floor=None), MARKET, BS)
    high = cliquet_black_scholes(Cliquet(local_cap=0.04, global_floor=None), MARKET, BS)
    assert low is not None and high is not None and high > low


@pytest.mark.parametrize("kind", ["call", "put"])
def test_forward_start_matches_quantlib(kind):
    ql = pytest.importorskip("QuantLib")
    today = ql.Date(15, 10, 2026)
    ql.Settings.instance().evaluationDate = today
    dc = ql.Actual365Fixed()
    process = ql.BlackScholesMertonProcess(
        ql.QuoteHandle(ql.SimpleQuote(100.0)),
        ql.YieldTermStructureHandle(ql.FlatForward(today, 0.01, dc)),
        ql.YieldTermStructureHandle(ql.FlatForward(today, 0.03, dc)),
        ql.BlackVolTermStructureHandle(ql.BlackConstantVol(today, ql.NullCalendar(), 0.25, dc)),
    )
    payoff = ql.PlainVanillaPayoff(ql.Option.Call if kind == "call" else ql.Option.Put, 100.0)
    theirs = ql.ForwardVanillaOption(1.1, today + 365, payoff, ql.EuropeanExercise(today + 730))
    theirs.setPricingEngine(ql.ForwardEuropeanEngine(process))
    ours = forward_start_black_scholes(ForwardStartOption(1.0, 2.0, 1.1, kind), MARKET, BS)
    assert ours == pytest.approx(theirs.NPV(), rel=1e-12)
