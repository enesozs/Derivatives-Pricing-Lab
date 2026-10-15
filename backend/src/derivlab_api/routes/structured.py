"""Structured products and portfolio risk."""

from dataclasses import replace

import numpy as np
from fastapi import APIRouter
from numpy.typing import NDArray

from derivlab import (
    BarrierOption,
    BlackScholes,
    DigitalOption,
    European,
    Heston,
    PlainVanilla,
    VanillaOption,
)
from derivlab.calibration.implied_vol import implied_volatility
from derivlab.multi_asset.market import CorrelatedBlackScholes, MultiAssetMarket
from derivlab.risk import STRESS_SCENARIOS, Position, portfolio_risk, scenario_report, stress_grid
from derivlab.risk.portfolio import Product
from derivlab.structured import (
    Autocallable,
    AutocallableResult,
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

from ..schemas.exotics import BlackScholesModelSpec
from ..schemas.hedging import HistogramOut
from ..schemas.structured import (
    AutocallableRequest,
    AutocallableResponse,
    CliquetRequest,
    CliquetResponse,
    Curve,
    ModelSpec,
    ModelValue,
    PositionIn,
    PositionRisk,
    ReverseConvertibleRequest,
    ReverseConvertibleResponse,
    RiskRequest,
    RiskResponse,
    ScenarioOut,
    VarianceRequest,
    VarianceResponse,
)

router = APIRouter(prefix="/structured", tags=["structured"])

SPOT = 100.0
SENSITIVITY_PATHS = 10_000


def _histogram(
    samples: NDArray[np.float64], bins: int = 40, reference: NDArray[np.float64] | None = None
) -> HistogramOut:
    """Counts between the 0.1% and 99.9% percentiles of `reference` (default: the samples
    themselves), so two distributions can share bins."""
    low, high = np.percentile(samples if reference is None else reference, [0.1, 99.9])
    if high <= low:
        low, high = low - 0.01, high + 0.01
    counts, edges = np.histogram(np.clip(samples, low, high), bins=bins, range=(low, high))
    return HistogramOut(edges=edges.tolist(), counts=counts.tolist())


def _at_level(spec: ModelSpec, level: float) -> BlackScholes | Heston:
    """The same model with its volatility level moved (Heston: v0 = theta = level^2)."""
    model = spec.build()
    if isinstance(model, Heston):
        return replace(model, v0=level**2, theta=level**2)
    return BlackScholes(level)


def _level(spec: ModelSpec) -> float:
    return spec.volatility if isinstance(spec, BlackScholesModelSpec) else spec.v0**0.5


# --- autocallable ------------------------------------------------------------------------------


@router.post("/autocallable")
def autocallable(req: AutocallableRequest) -> AutocallableResponse:
    note = Autocallable(
        req.maturity,
        req.frequency,
        req.coupon,
        req.autocall_level,
        req.coupon_barrier,
        req.protection_barrier,
        req.memory,
        req.monitoring,
        req.non_call_periods,
    )
    market = req.market(SPOT)
    if req.assets > 1 and not isinstance(req.model, BlackScholesModelSpec):
        raise ValueError("worst-of notes are priced under correlated Black–Scholes only")

    def price(level: float, rho: float, paths: int) -> AutocallableResult:
        if req.assets == 1:
            return price_autocallable(note, market, _at_level(req.model, level), paths)
        n = req.assets
        basket = MultiAssetMarket((SPOT,) * n, req.rate, (req.dividend_yield,) * n)
        model = CorrelatedBlackScholes.uniform((level,) * n, rho)
        return price_worst_of_autocallable(note, basket, model, paths)

    level = _level(req.model)
    result = price(level, req.correlation, req.paths)
    vols = [0.10, 0.15, 0.20, 0.25, 0.30, 0.35, 0.40, 0.45]
    coupon_vs_vol = Curve(
        x=vols, y=[price(v, req.correlation, SENSITIVITY_PATHS).fair_coupon for v in vols]
    )
    coupon_vs_correlation = None
    if req.assets > 1:
        rhos = [0.0, 0.2, 0.4, 0.6, 0.8, 0.95]
        coupon_vs_correlation = Curve(
            x=rhos, y=[price(level, r, SENSITIVITY_PATHS).fair_coupon for r in rhos]
        )
    return AutocallableResponse(
        value=result.value,
        stderr=result.stderr,
        fair_coupon=result.fair_coupon,
        observation_times=note.observation_times.tolist(),
        redemption_probabilities=list(result.redemption_probabilities),
        loss_probability=result.loss_probability,
        expected_life=result.expected_life,
        principal_value=result.principal_value,
        coupon_annuity=result.coupon_annuity,
        returns=_histogram(result.total_returns),
        coupon_vs_vol=coupon_vs_vol,
        coupon_vs_correlation=coupon_vs_correlation,
    )


# --- reverse convertible -----------------------------------------------------------------------


@router.post("/reverse-convertible")
def reverse_convertible(req: ReverseConvertibleRequest) -> ReverseConvertibleResponse:
    note = ReverseConvertible(req.maturity, req.coupon, req.frequency, req.strike, req.barrier)
    market = req.market(SPOT)
    model = req.model.build()
    d = note.decompose(market, model)
    levels = np.linspace(0.3, 1.5, 61)
    vols = [0.10, 0.15, 0.20, 0.25, 0.30, 0.40, 0.50, 0.60]
    return ReverseConvertibleResponse(
        bond=d["bond"],
        coupons=d["coupons"],
        short_put=d["short_put"],
        value=d["value"],
        fair_coupon=d["fair_coupon"],
        barrier_hit_probability=(
            barrier_hit_probability(note, market, model)
            if isinstance(model, BlackScholes)
            else None
        ),
        final_levels=levels.tolist(),
        redemption_hit=note.redemption(levels, True).tolist(),
        redemption_not_hit=note.redemption(levels, False).tolist(),
        coupon_total=req.coupon * note.coupon_times().size / req.frequency,
        coupon_vs_vol=Curve(
            x=vols,
            y=[note.decompose(market, _at_level(req.model, v))["fair_coupon"] for v in vols],
        ),
    )


# --- variance swap -----------------------------------------------------------------------------


@router.post("/variance")
def variance(req: VarianceRequest) -> VarianceResponse:
    market = req.market(SPOT)
    model = req.model.build()
    t = req.expiry
    rep = replicate_variance(market, model, t, req.n_strikes, req.width)
    implied: list[float | None] = []
    for k, price in zip(rep.strikes, rep.option_prices, strict=True):
        if price < 1e-6 * SPOT:  # far wings: prices are rounding noise, vols meaningless
            implied.append(None)
            continue
        kind = "put" if k < rep.forward else "call"
        option = VanillaOption(PlainVanilla(kind, float(k)), European(t))
        try:
            implied.append(implied_volatility(float(price), option, market).volatility)
        except ValueError:
            implied.append(None)
    counts = [5, 9, 17, 33, 65, 129, 257]
    convergence = Curve(
        x=[float(n) for n in counts],
        y=[replicate_variance(market, model, t, n, req.width).strike for n in counts],
    )
    rv = simulate_realised_variance(market, model, t, req.paths)
    return VarianceResponse(
        expected_variance=expected_variance(model, t),
        replicated_variance=rep.strike,
        forward=rep.forward,
        strikes=rep.strikes.tolist(),
        weights=rep.weights.tolist(),
        option_prices=rep.option_prices.tolist(),
        contributions=rep.contributions.tolist(),
        implied_vols=implied,
        convergence=convergence,
        simulated_variance=rv.fair_variance,
        simulated_variance_stderr=rv.fair_variance_stderr,
        fair_volatility=rv.fair_volatility,
        fair_volatility_stderr=rv.fair_volatility_stderr,
        convexity_adjustment=rv.convexity_adjustment,
        realised_vols=_histogram(np.sqrt(rv.variances)),
    )


# --- cliquet -----------------------------------------------------------------------------------


@router.post("/cliquet")
def cliquet(req: CliquetRequest) -> CliquetResponse:
    market = req.market(SPOT)
    contract = Cliquet(
        req.maturity, req.periods, req.local_floor, req.local_cap, req.global_floor, req.global_cap
    )
    level = req.volatility
    models = {
        "black_scholes": BlackScholes(level),
        "heston": Heston(level**2, req.kappa, level**2, req.xi, req.rho),
    }
    results = {name: price_cliquet(contract, market, m, req.paths) for name, m in models.items()}
    caps = [0.01, 0.02, 0.03, 0.04, 0.05, 0.06]
    curves = {
        name: Curve(
            x=caps,
            y=[
                price_cliquet(replace(contract, local_cap=c), market, m, SENSITIVITY_PATHS).value
                for c in caps
            ],
        )
        for name, m in models.items()
        if contract.local_floor is None or contract.local_floor < min(caps)
    }
    forward = ForwardStartOption(1.0, 2.0)
    fs = {}
    for name, m in models.items():
        value, stderr = forward_start_monte_carlo(forward, market, m)
        fs[name] = ModelValue(value=value, stderr=stderr)
    both = np.concatenate([r.payoffs for r in results.values()])
    bs_model = models["black_scholes"]
    assert isinstance(bs_model, BlackScholes)
    return CliquetResponse(
        black_scholes=ModelValue(
            value=results["black_scholes"].value, stderr=results["black_scholes"].stderr
        ),
        heston=ModelValue(value=results["heston"].value, stderr=results["heston"].stderr),
        closed_form=cliquet_black_scholes(contract, market, bs_model),
        payoffs_black_scholes=_histogram(results["black_scholes"].payoffs, 30, both),
        payoffs_heston=_histogram(results["heston"].payoffs, 30, both),
        value_vs_local_cap=curves,
        forward_start=fs,
        forward_start_closed_form=forward_start_black_scholes(forward, market, bs_model),
    )


# --- portfolio risk ----------------------------------------------------------------------------


def _product(p: PositionIn) -> Product:
    k, t = p.strike, p.expiry
    b = p.barrier
    match p.product:
        case "call" | "put":
            return VanillaOption(PlainVanilla(p.product, k), European(t))
        case "digital_call" | "digital_put":
            return DigitalOption("call" if p.product == "digital_call" else "put", k, t)
        case "down_in_put":
            return BarrierOption("put", k, t, b or 0.7 * k, "down", "in")
        case "up_out_call":
            return BarrierOption("call", k, t, b or 1.3 * k, "up", "out")
        case "reverse_convertible":
            return ReverseConvertible(t, p.coupon, 4, k / SPOT, None if b is None else b / SPOT)
        case "autocallable":
            periods = max(1, round(t * 4))
            return Autocallable(periods / 4, 4, p.coupon, 1.0, 0.7, (b or 60.0) / SPOT)


@router.post("/risk")
def risk(req: RiskRequest) -> RiskResponse:
    market = req.market(SPOT)
    model = BlackScholes(req.volatility)
    positions = [Position(_product(p), p.quantity, p.label or p.product) for p in req.positions]
    r = portfolio_risk(positions, market, model)
    spot_shifts = [-0.3, -0.2, -0.1, 0.0, 0.1, 0.2, 0.3]
    vol_shifts = [-0.10, -0.05, 0.0, 0.05, 0.10, 0.20]
    grid = stress_grid(positions, market, model, spot_shifts, vol_shifts)
    rows = [
        PositionRisk(
            label=p.label,
            value=float(r.values[i]),
            delta=float(r.delta[i]),
            gamma=float(r.gamma[i]),
            vega=float(r.vega[i]),
            rho=float(r.rho[i]),
        )
        for i, p in enumerate(positions)
    ]
    total = PositionRisk(
        label="Book",
        value=r.total,
        delta=float(r.delta.sum()),
        gamma=float(r.gamma.sum()),
        vega=float(r.vega.sum()),
        rho=float(r.rho.sum()),
    )
    scenarios = scenario_report(positions, market, model, STRESS_SCENARIOS, r)
    return RiskResponse(
        positions=rows,
        total=total,
        spot_shifts=spot_shifts,
        vol_shifts=vol_shifts,
        grid=grid.tolist(),
        scenarios=[ScenarioOut(name=s.name, full=s.full, taylor=s.taylor) for s in scenarios],
    )
