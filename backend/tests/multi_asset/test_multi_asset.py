import numpy as np
import pytest

from derivlab.core.bivariate import bivariate_normal_cdf
from derivlab.multi_asset import (
    BasketOption,
    CorrelatedBlackScholes,
    ExchangeOption,
    MultiAssetAnalyticEngine,
    MultiAssetMarket,
    MultiAssetMonteCarloEngine,
    QuantoMarket,
    QuantoModel,
    QuantoOption,
    RainbowOption,
    SpreadOption,
    correlated_paths,
)
from derivlab.multi_asset.analytic import quanto_price
from derivlab.multi_asset.montecarlo import quanto_monte_carlo

MARKET = MultiAssetMarket((100.0, 95.0), 0.05, (0.02, 0.01))
MODEL = CorrelatedBlackScholes.uniform((0.25, 0.30), 0.4)
EXACT = MultiAssetAnalyticEngine()


@pytest.fixture(scope="module")
def ql_env():
    ql = pytest.importorskip("QuantLib")
    today = ql.Date(15, 10, 2026)
    ql.Settings.instance().evaluationDate = today
    dc = ql.Actual365Fixed()

    def flat(r):
        return ql.YieldTermStructureHandle(ql.FlatForward(today, r, dc))

    def process(spot, q, vol):
        vols = ql.BlackVolTermStructureHandle(
            ql.BlackConstantVol(today, ql.NullCalendar(), vol, dc)
        )
        return ql.BlackScholesMertonProcess(
            ql.QuoteHandle(ql.SimpleQuote(spot)), flat(q), flat(0.05), vols
        )

    return ql, today, process(100.0, 0.02, 0.25), process(95.0, 0.01, 0.30), flat


def test_bivariate_normal_matches_quantlib(ql_env):
    ql = ql_env[0]
    for a in (-2.5, -0.3, 0.0, 1.2):
        for b in (-1.0, 0.4, 2.0):
            for rho in (-0.999, -0.7, 0.0, 0.5, 0.93, 0.999):
                expected = ql.BivariateCumulativeNormalDistributionWe04DP(rho)(a, b)
                assert bivariate_normal_cdf(a, b, rho) == pytest.approx(expected, abs=1e-14)


def test_margrabe_matches_quantlib(ql_env):
    ql, today, p1, p2, _ = ql_env
    option = ql.MargrabeOption(1, 1, ql.EuropeanExercise(today + 365))
    option.setPricingEngine(ql.AnalyticEuropeanMargrabeEngine(p1, p2, 0.4))
    assert EXACT.price(ExchangeOption(1.0), MARKET, MODEL).value == pytest.approx(
        option.NPV(), abs=1e-10
    )


@pytest.mark.parametrize("style", ["best", "worst"])
@pytest.mark.parametrize("kind", ["call", "put"])
def test_stulz_matches_quantlib(style, kind, ql_env):
    ql, today, p1, p2, _ = ql_env
    vanilla = ql.PlainVanillaPayoff(ql.Option.Call if kind == "call" else ql.Option.Put, 100.0)
    payoff = ql.MaxBasketPayoff(vanilla) if style == "best" else ql.MinBasketPayoff(vanilla)
    option = ql.BasketOption(payoff, ql.EuropeanExercise(today + 365))
    option.setPricingEngine(ql.StulzEngine(p1, p2, 0.4))
    ours = EXACT.price(RainbowOption(kind, 100.0, 1.0, style), MARKET, MODEL).value  # type: ignore[arg-type]
    assert ours == pytest.approx(option.NPV(), abs=1e-9)


def test_kirk_matches_quantlib(ql_env):
    ql, today, p1, p2, _ = ql_env
    payoff = ql.SpreadBasketPayoff(ql.PlainVanillaPayoff(ql.Option.Call, 5.0))
    option = ql.BasketOption(payoff, ql.EuropeanExercise(today + 365))
    option.setPricingEngine(ql.KirkEngine(p1, p2, 0.4))
    assert EXACT.price(SpreadOption("call", 5.0, 1.0), MARKET, MODEL).value == pytest.approx(
        option.NPV(), abs=1e-9
    )


def test_quanto_matches_quantlib(ql_env):
    ql, today, _, _, flat = ql_env
    vols = ql.BlackVolTermStructureHandle(
        ql.BlackConstantVol(today, ql.NullCalendar(), 0.25, ql.Actual365Fixed())
    )
    fx_vols = ql.BlackVolTermStructureHandle(
        ql.BlackConstantVol(today, ql.NullCalendar(), 0.12, ql.Actual365Fixed())
    )
    process = ql.BlackScholesMertonProcess(
        ql.QuoteHandle(ql.SimpleQuote(100.0)), flat(0.01), flat(0.05), vols
    )
    option = ql.QuantoVanillaOption(
        ql.PlainVanillaPayoff(ql.Option.Call, 100.0), ql.EuropeanExercise(today + 365)
    )
    option.setPricingEngine(
        ql.QuantoEuropeanEngine(process, flat(0.02), fx_vols, ql.QuoteHandle(ql.SimpleQuote(0.4)))
    )
    ours = quanto_price(
        QuantoOption("call", 100.0, 1.0),
        QuantoMarket(100, 0.05, 0.02, 0.01),
        QuantoModel(0.25, 0.12, 0.4),
    )
    assert ours == pytest.approx(option.NPV(), abs=1e-10)


def test_quanto_monte_carlo():
    args = (
        QuantoOption("put", 100.0, 1.0),
        QuantoMarket(100, 0.05, 0.02, 0.01),
        QuantoModel(0.25, 0.12, 0.4),
    )
    mc = quanto_monte_carlo(*args, paths=100_000, seed=3)
    assert mc.stderr is not None and abs(mc.value - quanto_price(*args)) < 4 * mc.stderr


@pytest.mark.parametrize(
    "option",
    [
        ExchangeOption(1.0),
        RainbowOption("call", 100.0, 1.0, "best"),
        RainbowOption("put", 100.0, 1.0, "worst"),
    ],
    ids=["exchange", "best-of-call", "worst-of-put"],
)
def test_monte_carlo_agrees_with_exact_forms(option):
    exact = EXACT.price(option, MARKET, MODEL).value
    mc = MultiAssetMonteCarloEngine(paths=100_000, seed=11).price(option, MARKET, MODEL)
    assert mc.stderr is not None and abs(mc.value - exact) < 4 * mc.stderr


def test_levy_basket_is_a_close_approximation():
    option = BasketOption("call", 100.0, 1.0, (0.5, 0.5))
    mc = MultiAssetMonteCarloEngine(paths=200_000).price(option, MARKET, MODEL)
    assert mc.diagnostics["control_variate"] == "geometric basket"
    assert EXACT.price(option, MARKET, MODEL).value == pytest.approx(mc.value, rel=0.005)


def test_correlation_moves_prices_in_the_expected_direction():
    def price(option, rho):
        return EXACT.price(option, MARKET, CorrelatedBlackScholes.uniform((0.25, 0.30), rho)).value

    for option, sign in [
        (ExchangeOption(1.0), -1),  # less dispersion between assets
        (RainbowOption("call", 100.0, 1.0, "best"), -1),
        (RainbowOption("call", 100.0, 1.0, "worst"), +1),
        (BasketOption("call", 100.0, 1.0, (0.5, 0.5)), +1),  # less diversification
    ]:
        assert sign * (price(option, 0.8) - price(option, -0.5)) > 0


def test_perfect_correlation_and_identical_assets_reduce_to_one_asset():
    market = MultiAssetMarket((100.0, 100.0), 0.05, (0.0, 0.0))
    # Near-perfect correlation: the residual exchange value is ~0.4 * S * sigma_hat * sqrt(T).
    model = CorrelatedBlackScholes.uniform((0.2, 0.2), 0.999999)
    best = EXACT.price(RainbowOption("call", 100.0, 1.0, "best"), market, model).value
    worst = EXACT.price(RainbowOption("call", 100.0, 1.0, "worst"), market, model).value
    assert worst <= 10.4506 <= best
    assert best - worst == pytest.approx(0.0, abs=0.03)


def test_correlated_paths_have_the_right_correlation():
    model = CorrelatedBlackScholes.uniform((0.2, 0.3, 0.25), 0.6)
    market = MultiAssetMarket((100.0, 50.0, 80.0), 0.03, (0.0, 0.0, 0.0))
    paths = correlated_paths(market, model, 1.0, 1, 200_000, np.random.default_rng(0))
    returns = np.log(paths[:, -1, :] / paths[:, 0, :])
    assert np.allclose(np.corrcoef(returns.T), model.matrix, atol=0.01)
    assert np.allclose(paths[:, -1, :].mean(axis=0), market.forwards(1.0), rtol=5e-3)


@pytest.mark.parametrize(
    "build",
    [
        lambda: CorrelatedBlackScholes((0.2, 0.2), ((1.0, 0.5), (0.4, 1.0))),  # not symmetric
        lambda: CorrelatedBlackScholes.uniform((0.2, 0.2, 0.2), -0.8),  # not PSD
        lambda: MultiAssetMarket((100.0,), 0.05, (0.0,)),
        lambda: BasketOption("call", 100.0, 1.0, (-1.0, 2.0)),
    ],
)
def test_invalid_inputs(build):
    with pytest.raises(ValueError):
        build()
