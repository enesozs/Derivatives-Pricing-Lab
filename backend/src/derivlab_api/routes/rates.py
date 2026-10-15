"""Interest-rate endpoints: curves, swaps, bonds, caps/floors/swaptions, short-rate models."""

import numpy as np
from fastapi import APIRouter

from derivlab.rates import (
    CapFloor,
    DiscountCurve,
    FixedRateBond,
    InterestRateSwap,
    Swaption,
    bootstrap,
    implied_vol,
    option_value,
    repricing_errors,
)
from derivlab.rates.short_rate import HullWhite, Vasicek, calibrate_hull_white_to_caps
from derivlab.rates.tree import bermudan_swaption

from ..schemas.rates import (
    BondRequest,
    BondResponse,
    CalibrationRequest,
    CalibrationResponse,
    CurveInput,
    CurveResponse,
    FanOut,
    RateOptionRequest,
    RateOptionResponse,
    ShortRateRequest,
    ShortRateResponse,
    SwapRequest,
    SwapResponse,
)

router = APIRouter(prefix="/rates", tags=["rates"])


def _curve(req: CurveInput) -> DiscountCurve:
    return bootstrap([q.build() for q in req.quotes])


@router.post("/curve")
def curve(req: CurveInput) -> CurveResponse:
    quotes = sorted((q.build() for q in req.quotes), key=lambda q: q.maturity)
    c = bootstrap(quotes)
    grid = np.linspace(0.05, max(c.times[-1], 1.0), 240)
    tenors = np.array([1, 2, 3, 4, 5, 7, 10, 12, 15, 20, 25, 30], dtype=float)
    tenors = tenors[tenors <= c.times[-1] + 1e-9]
    return CurveResponse(
        node_labels=[q.label for q in quotes],
        node_times=list(c.times),
        node_discount=list(c.discount_factors),
        node_zero=c.zero_rate(np.array(c.times)).tolist(),
        repricing_errors=repricing_errors(c, quotes),
        grid=grid.tolist(),
        zero=c.zero_rate(grid).tolist(),
        forward=c.instantaneous_forward(grid).tolist(),
        discount=c.discount(grid).tolist(),
        par_tenors=tenors.tolist(),
        par_rates=[InterestRateSwap(0.0, float(t)).par_rate(c) for t in tenors],
    )


@router.post("/swap")
def swap(req: SwapRequest) -> SwapResponse:
    c = _curve(req)
    par = InterestRateSwap(0.0, req.maturity, req.frequency).par_rate(c)
    fixed = par if req.fixed_rate is None else req.fixed_rate
    s = InterestRateSwap(fixed, req.maturity, req.frequency, req.notional, req.payer)
    shifts = np.linspace(-200, 200, 41)
    return SwapResponse(
        fixed_rate=fixed,
        par_rate=par,
        npv=s.npv(c),
        annuity=s.annuity(c),
        dv01=s.dv01(c),
        cash_flows=s.cash_flows(c),
        shifts_bp=shifts.tolist(),
        shifted_npv=[s.npv(c.shifted(float(b))) for b in shifts],
    )


@router.post("/bond")
def bond(req: BondRequest) -> BondResponse:
    c = _curve(req)
    b = FixedRateBond(req.coupon, req.maturity, req.frequency)
    price = b.price(c)
    y = b.yield_to_maturity(price)
    risk = b.risk(y)
    yields = np.linspace(max(y - 0.03, -0.01), y + 0.03, 61)
    dy = yields - y
    return BondResponse(
        price=price,
        yield_to_maturity=y,
        macaulay_duration=risk["macaulay_duration"],
        modified_duration=risk["modified_duration"],
        convexity=risk["convexity"],
        dv01=risk["dv01"],
        yields=yields.tolist(),
        exact=[b.price_from_yield(float(v)) for v in yields],
        duration_approx=(price * (1 - risk["modified_duration"] * dy)).tolist(),
        convexity_approx=(
            price * (1 - risk["modified_duration"] * dy + 0.5 * risk["convexity"] * dy**2)
        ).tolist(),
    )


@router.post("/options")
def rate_options(req: RateOptionRequest) -> RateOptionResponse:
    c = _curve(req)
    other = "bachelier" if req.vol_model == "black" else "black"
    caplets = None
    if req.product in ("cap", "floor"):
        # ATM strike: the swap rate over the caplet periods.
        probe = CapFloor(0.04, req.maturity, req.frequency, req.notional)
        rows = probe.caplets(c, 0.2)
        times = np.array([r["payment"] for r in rows])
        starts = np.array([r["fixing"] for r in rows])
        annuity = float(((times - starts) * c.discount(times)).sum())
        atm = (c.df(starts[0]) - c.df(times[-1])) / annuity
        strike = atm if req.strike is None else req.strike
        instrument = CapFloor(
            strike, req.maturity, req.frequency, req.notional, req.product == "cap"
        )
        price = instrument.price(c, req.vol, req.vol_model)
        caplets = instrument.caplets(c, req.vol, req.vol_model)
        # Representative single option for the smile: the last caplet.
        t_opt, forward = starts[-1], caplets[-1]["forward"]
        call = req.product == "cap"
    else:
        probe_sw = Swaption(req.expiry, req.tenor, 0.04, 1, req.notional)
        atm = probe_sw.forward_swap_rate(c)
        strike = atm if req.strike is None else req.strike
        instrument_sw = Swaption(
            req.expiry, req.tenor, strike, 1, req.notional, req.product == "payer"
        )
        price = instrument_sw.price(c, req.vol, req.vol_model)
        t_opt, forward = req.expiry, atm
        call = req.product == "payer"

    # Equivalent vol in the other model, at the chosen strike.
    try:
        undiscounted = option_value(req.vol_model, forward, strike, t_opt, req.vol, call)
        equivalent = implied_vol(other, undiscounted, forward, strike, t_opt, call)
    except ValueError:
        equivalent = None

    # Smile comparison around the forward: flat Black vol vs Bachelier with the ATM-matched vol.
    if req.vol_model == "black":
        black_vol = req.vol
        normal_vol = implied_vol(
            "bachelier",
            option_value("black", forward, forward, t_opt, black_vol, True),
            forward,
            forward,
            t_opt,
            True,
        )
    else:
        normal_vol = req.vol
        black_vol = (
            implied_vol(
                "black",
                option_value("bachelier", forward, forward, t_opt, normal_vol, True),
                forward,
                forward,
                t_opt,
                True,
            )
            if forward > 0
            else 0.2
        )
    strikes = np.linspace(max(forward * 0.4, 0.002), forward * 1.8, 29)
    from_normal: list[float | None] = []
    for k in strikes:
        value = option_value("bachelier", forward, float(k), t_opt, normal_vol, bool(k >= forward))
        try:
            from_normal.append(
                implied_vol("black", value, forward, float(k), t_opt, bool(k >= forward))
            )
        except ValueError:
            from_normal.append(None)
    return RateOptionResponse(
        price=price,
        strike=strike,
        atm_forward=forward,
        equivalent_vol=equivalent,
        caplets=caplets,
        smile_strikes=strikes.tolist(),
        smile_black=[black_vol] * len(strikes),
        smile_from_normal=from_normal,
    )


def _fan(times: np.ndarray, paths: np.ndarray) -> FanOut:
    p = np.percentile(paths, [5, 25, 50, 75, 95], axis=0)
    return FanOut(
        times=times.tolist(),
        p05=p[0].tolist(),
        p25=p[1].tolist(),
        p50=p[2].tolist(),
        p75=p[3].tolist(),
        p95=p[4].tolist(),
    )


@router.post("/short-rate")
def short_rate(req: ShortRateRequest) -> ShortRateResponse:
    c = _curve(req)
    steps = 120
    times = np.linspace(0, req.horizon, steps + 1)
    hw = HullWhite(req.a, req.sigma, c)
    r0 = float(c.zero_rate(1e-3))
    vasicek = Vasicek(req.a, req.vasicek_b, req.sigma, r0)
    hw_paths = hw.simulate(req.horizon, steps, 4000)
    v_paths = vasicek.simulate(req.horizon, steps, 4000)
    zt = np.linspace(0.25, min(30.0, c.times[-1]), 60)
    hw_zero = -np.log(hw.bond_price(0.0, zt, r0)) / zt  # reproduces the market curve
    strike = Swaption(req.swaption_expiry, req.swaption_tenor, 0.0).forward_swap_rate(c)
    sw = Swaption(req.swaption_expiry, req.swaption_tenor, strike, 1, 10_000_000)
    return ShortRateResponse(
        hull_white=_fan(times, hw_paths),
        vasicek=_fan(times, v_paths),
        market_zero_times=zt.tolist(),
        market_zero=c.zero_rate(zt).tolist(),
        vasicek_zero=(-np.log(vasicek.discount(zt)) / zt).tolist(),
        hull_white_zero=hw_zero.tolist(),
        swaption_strike=strike,
        european_jamshidian=hw.swaption_price(sw),
        european_tree=bermudan_swaption(sw, req.a, req.sigma, c, 48, bermudan=False),
        bermudan_tree=bermudan_swaption(sw, req.a, req.sigma, c, 48),
    )


@router.post("/calibrate-hull-white")
def calibrate(req: CalibrationRequest) -> CalibrationResponse:
    if len(req.maturities) != len(req.black_vols):
        raise ValueError("one Black vol per cap maturity")
    fit = calibrate_hull_white_to_caps(_curve(req), req.maturities, req.black_vols)
    return CalibrationResponse(
        a=fit.model.a,
        sigma=fit.model.sigma,
        rmse=fit.rmse,
        maturities=list(fit.maturities),
        market_vols=list(fit.market_vols),
        model_vols=list(fit.model_vols),
    )
