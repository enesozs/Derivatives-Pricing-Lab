"""Credit: CDS pricing and hazard curves; counterparty risk on a swap."""

import numpy as np
from fastapi import APIRouter

from derivlab.credit import (
    CDS,
    bootstrap_hazard,
    credit_adjustments,
    cva_spread,
    flat_hazard_from_spread,
    repricing_errors,
    swap_exposure,
)
from derivlab.rates import DiscountCurve, HullWhite, InterestRateSwap, Swaption

from ..schemas.credit import (
    CDSNode,
    CDSQuoteIn,
    CDSRequest,
    CDSResponse,
    XVARequest,
    XVAResponse,
)

router = APIRouter(prefix="/credit", tags=["credit"])

STEPS_PER_PERIOD = 12


@router.post("/cds")
def cds(req: CDSRequest) -> CDSResponse:
    curve = DiscountCurve.flat(req.rate)
    quotes = sorted((q.build() for q in req.quotes), key=lambda q: q.maturity)
    hazard = bootstrap_hazard(quotes, curve, req.recovery)
    errors = repricing_errors(quotes, curve, hazard, req.recovery)
    contract = CDS(req.maturity, req.coupon, req.recovery)
    legs = contract.legs(curve, hazard)
    par = legs["protection"] / legs["rpv01"]

    # CS01: buyer's value change for a +1bp parallel move in every quoted spread.
    bumped = bootstrap_hazard(
        [CDSQuoteIn(maturity=q.maturity, spread=q.spread + 1e-4).build() for q in quotes],
        curve,
        req.recovery,
    )
    cs01 = req.notional * (contract.npv(curve, bumped) - contract.npv(curve, hazard))
    horizon = max(max(q.maturity for q in quotes), req.maturity) * 1.2
    grid = np.linspace(0, horizon, 121)
    return CDSResponse(
        nodes=[
            CDSNode(
                maturity=q.maturity,
                spread=q.spread,
                hazard=h,
                survival=float(hazard.survival(q.maturity)),
                triangle_hazard=q.spread / (1 - req.recovery),
                repricing_error=e,
            )
            for q, h, e in zip(quotes, hazard.hazards, errors, strict=True)
        ],
        grid=grid.tolist(),
        survival=hazard.survival(grid).tolist(),
        hazard=hazard.hazard(grid).tolist(),
        par_spread=par,
        rpv01=legs["rpv01"],
        protection_leg=legs["protection"],
        upfront=legs["protection"] - req.coupon * legs["rpv01"],
        default_probability=float(1 - hazard.survival(req.maturity)),
        cs01=cs01,
    )


@router.post("/xva")
def xva(req: XVARequest) -> XVAResponse:
    curve = DiscountCurve.flat(req.rate)
    model = HullWhite(req.a, req.sigma, curve)
    par = InterestRateSwap(0.0, req.maturity, req.frequency).par_rate(curve)
    fixed = par if req.fixed_rate is None else req.fixed_rate
    swap = InterestRateSwap(fixed, req.maturity, req.frequency, req.notional, req.payer)
    profile = swap_exposure(swap, model, req.paths, STEPS_PER_PERIOD, threshold=req.threshold)
    counterparty = flat_hazard_from_spread(req.counterparty_spread, req.counterparty_recovery)
    own = (
        None
        if req.own_spread is None
        else flat_hazard_from_spread(req.own_spread, req.own_recovery)
    )
    adj = credit_adjustments(
        profile, counterparty, req.counterparty_recovery, own, req.own_recovery
    )

    pay, _ = swap.schedule()
    resets = [float(t) for t in pay[:-1]]
    check_exact = [
        model.swaption_price(
            Swaption(t, req.maturity - t, fixed, req.frequency, req.notional, req.payer)
        )
        for t in resets
    ]
    check_idx = [round(t / req.maturity * (len(profile.times) - 1)) for t in resets]
    return XVAResponse(
        fixed_rate=fixed,
        swap_value=swap.npv(curve),
        times=profile.times.tolist(),
        discounted_ee=profile.discounted_ee.tolist(),
        discounted_ene=profile.discounted_ene.tolist(),
        epe=profile.epe.tolist(),
        pfe95=profile.pfe95.tolist(),
        sample_values=profile.sample_values.tolist(),
        cva=adj.cva,
        dva=adj.dva,
        bilateral=adj.bilateral,
        cva_running_bp=cva_spread(adj.cva, swap, model) * 1e4,
        cva_by_time=adj.cva_by_time.tolist(),
        dva_by_time=adj.dva_by_time.tolist(),
        check_times=resets,
        check_simulated=[float(profile.discounted_ee[i]) for i in check_idx],
        check_exact=check_exact,
    )
