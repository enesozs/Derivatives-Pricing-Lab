"""Volatility surface, calibration and model-playground endpoints."""

import math
import time
from functools import lru_cache

import numpy as np
from fastapi import APIRouter, HTTPException

from derivlab import Market
from derivlab.calibration import (
    VolSurface,
    build_surface,
    calibrate_heston,
    calibrate_sabr,
    implied_volatility,
)
from derivlab.data import (
    SurfaceData,
    available_snapshots,
    clean_chain,
    load_snapshot,
    synthetic_chain,
)
from derivlab.engines.fourier import cos_prices, risk_neutral_density
from derivlab.instruments import European, PlainVanilla, VanillaOption
from derivlab.models import SABR

from ..schemas.volatility import (
    CalendarViolationOut,
    CalibrationRequest,
    CalibrationResponse,
    ModelSmileOut,
    ModelSmileRequest,
    ModelSmileResponse,
    SliceFitOut,
    SliceOut,
    SmilePointOut,
    SnapshotInfo,
    SourceRequest,
    SourcesResponse,
    SurfaceGrid,
    SurfaceMeta,
    SurfaceResponse,
    SVIOut,
)

router = APIRouter(prefix="/volatility", tags=["volatility"])

LIVE_CACHE_SECONDS = 300


def _live_available() -> bool:
    try:
        import yfinance  # noqa: F401
    except ImportError:
        return False
    return True


@lru_cache(maxsize=16)
def _load(
    source: str, snapshot: str | None, ticker: str, rate: float, bucket: int
) -> tuple[SurfaceData, VolSurface]:
    """Clean and fit once per (source, rate); `bucket` expires live data every few minutes."""
    del bucket
    if source == "synthetic":
        chain = synthetic_chain()
    elif source == "snapshot":
        names = available_snapshots()
        if not names:
            raise ValueError("no bundled snapshots")
        chain = load_snapshot(snapshot or names[0])
    else:
        from derivlab.data.yahoo import fetch_chain

        chain = fetch_chain(ticker)
    data = clean_chain(chain, rate=rate)
    return data, build_surface(data)


def load_surface(req: SourceRequest) -> tuple[SurfaceData, VolSurface]:
    bucket = int(time.time() // LIVE_CACHE_SECONDS) if req.source == "live" else 0
    try:
        return _load(req.source, req.snapshot, req.ticker.upper(), round(req.rate, 6), bucket)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e)) from e
    except Exception as e:  # network or vendor failures for live data
        if req.source == "live":
            raise HTTPException(status_code=502, detail=f"Could not load {req.ticker}: {e}") from e
        raise


@router.get("/sources")
def sources() -> SourcesResponse:
    infos = []
    for name in available_snapshots():
        chain = load_snapshot(name)
        infos.append(
            SnapshotInfo(
                id=name, ticker=chain.ticker, as_of=chain.as_of, description=chain.description
            )
        )
    return SourcesResponse(snapshots=infos, live_available=_live_available())


@router.post("/surface")
def surface(req: SourceRequest) -> SurfaceResponse:
    data, surf = load_surface(req)
    slices = []
    for sl, fitted in zip(data.slices, surf.slices, strict=True):
        p = fitted.fit.params
        k_min, k_max = fitted.fit.k_range
        fit_k = np.linspace(k_min, k_max, 80)
        slices.append(
            SliceOut(
                expiry=sl.expiry,
                t=sl.t,
                forward=sl.forward,
                discount=sl.discount,
                forward_method=sl.forward_method,
                atm_vol=sl.atm_vol,
                dropped=sl.dropped,
                points=[
                    SmilePointOut(
                        strike=pt.strike,
                        log_moneyness=pt.log_moneyness,
                        implied_vol=pt.implied_vol,
                        kind=pt.kind,
                        price_source=pt.price_source,
                    )
                    for pt in sl.points
                ],
                svi=SVIOut(
                    a=p.a,
                    b=p.b,
                    rho=p.rho,
                    m=p.m,
                    sigma=p.sigma,
                    rmse=fitted.fit.rmse,
                    butterfly_violations=len(fitted.fit.butterfly_violations),
                    k_min=k_min,
                    k_max=k_max,
                ),
                fit_k=fit_k.tolist(),
                fit_vol=p.implied_vol(fit_k, sl.t).tolist(),
            )
        )

    # Show the surface only where quotes exist: from the first expiry of at least ~3 weeks
    # (shorter smiles span too little moneyness), over the moneyness range most expiries cover.
    # Beyond that, SVI wings are extrapolation and can reach absurd levels.
    t_min = next((s.t for s in surf.slices if s.t >= 0.06), surf.slices[0].t)
    t_max = surf.slices[-1].t
    maturities = np.geomspace(t_min, t_max, 30)
    k_low = float(np.median([s.fit.k_range[0] for s in surf.slices]))
    k_high = float(np.median([s.fit.k_range[1] for s in surf.slices]))
    ks = np.linspace(max(k_low, -0.5), min(k_high, 0.5), 41)
    cap = 1.5 * max(p.implied_vol for sl in data.slices for p in sl.points)
    implied, local, fallbacks = [], [], 0
    for t in maturities:
        implied.append(
            np.clip(np.sqrt(np.maximum(surf.total_variance(ks, t), 0) / t), 0, cap).tolist()
        )
        variance, clipped = surf.local_variance(ks, t)
        local.append(np.clip(np.sqrt(np.clip(variance, 1e-6, 25.0)), 0, cap).tolist())
        fallbacks += clipped

    return SurfaceResponse(
        meta=SurfaceMeta(
            ticker=data.ticker,
            spot=data.spot,
            as_of=data.as_of,
            source="live" if data.source == "yahoo" else data.source,
            description=data.description,
            synthetic=data.synthetic,
            price_basis=data.price_basis,
        ),
        slices=slices,
        calendar_violations=[
            CalendarViolationOut(t_short=v.t_short, t_long=v.t_long, count=len(v.log_moneyness))
            for v in surf.calendar_violations()
        ],
        grid=SurfaceGrid(
            log_moneyness=ks.tolist(),
            maturities=maturities.tolist(),
            implied_vol=implied,
            local_vol=local,
            local_vol_fallbacks=fallbacks,
        ),
    )


@router.post("/calibrate")
def calibrate(req: CalibrationRequest) -> CalibrationResponse:
    data, _ = load_surface(req)
    if req.model == "heston":
        result = calibrate_heston(data)
        fits, rmse, runtime = result.slices, result.rmse, result.runtime_ms
        parameters = [vars(result.model)]
        feller: bool | None = result.model.feller_satisfied
    else:
        sabr = calibrate_sabr(data, req.beta)
        fits, rmse, runtime = sabr.slices, sabr.rmse, sabr.runtime_ms
        parameters = [vars(m) for m in sabr.models]
        feller = None
    return CalibrationResponse(
        model=req.model,
        parameters=[{k: float(v) for k, v in p.items()} for p in parameters],
        rmse=rmse,
        runtime_ms=runtime,
        feller_satisfied=feller,
        slices=[
            SliceFitOut(
                expiry=sl.expiry,
                t=fit.t,
                forward=fit.forward,
                strikes=list(fit.strikes),
                log_moneyness=[math.log(k / fit.forward) for k in fit.strikes],
                market_vol=list(fit.market_vols),
                model_vol=list(fit.model_vols),
                rmse=fit.rmse,
            )
            for sl, fit in zip(data.slices, fits, strict=True)
        ],
    )


@router.post("/model-smile")
def model_smile(req: ModelSmileRequest) -> ModelSmileResponse:
    model = req.params.build()
    market = Market(req.spot, req.rate, req.dividend_yield)
    strikes = req.spot * np.linspace(0.6, 1.4, 41)
    density_spots = req.spot * np.linspace(0.3, 2.0, 200)
    smiles = []
    for t in sorted(req.expiries):
        if isinstance(model, SABR):
            sabr_vols = model.implied_volatility(market.forward(t), strikes, t)
            smiles.append(
                ModelSmileOut(
                    t=t,
                    strikes=strikes.tolist(),
                    implied_vol=[float(v) for v in sabr_vols],
                    density=None,
                )
            )
            continue
        forward = market.forward(t)
        calls = cos_prices("call", strikes, t, market, model)
        puts = cos_prices("put", strikes, t, market, model)
        vols: list[float | None] = []
        for k, call, put in zip(strikes, calls, puts, strict=True):
            kind = "call" if k >= forward else "put"  # out-of-the-money side is better conditioned
            option = VanillaOption(PlainVanilla(kind, float(k)), European(t))
            try:
                vols.append(
                    implied_volatility(
                        float(call if kind == "call" else put), option, market
                    ).volatility
                )
            except ValueError:
                vols.append(None)
        density = risk_neutral_density(model, t, market, density_spots)
        smiles.append(
            ModelSmileOut(t=t, strikes=strikes.tolist(), implied_vol=vols, density=density.tolist())
        )

    # Lognormal reference density with the longest expiry's at-the-money vol.
    last = smiles[-1]
    mid = len(strikes) // 2
    atm = last.implied_vol[mid] or 0.2
    t = last.t
    mu = math.log(req.spot) + (req.rate - req.dividend_yield - 0.5 * atm**2) * t
    reference = np.exp(-((np.log(density_spots) - mu) ** 2) / (2 * atm**2 * t)) / (
        density_spots * atm * math.sqrt(2 * math.pi * t)
    )
    return ModelSmileResponse(
        model=req.params.model,
        density_spots=density_spots.tolist(),
        smiles=smiles,
        reference_density=reference.tolist(),
    )
