"""Calibrating stochastic-volatility models to a market smile or surface.

Heston (whole surface, 5 parameters): minimise vega-scaled price errors,
(model price - market price) / market vega, which approximate implied-volatility errors but
need no implied-volatility inversion inside the loop. Each evaluation prices every quote of an
expiry in one vectorised COS call, so a full calibration takes well under a second.

SABR (one expiry at a time, beta fixed): Hagan's formula gives implied volatility directly, so
residuals are plain implied-volatility errors.

Both report the fitted model's implied volatilities next to the market's, which is how fit
quality is judged in practice.
References: Gatheral, The Volatility Surface, ch. 3; Hagan et al. (2002).
"""

from __future__ import annotations

import math
import time
from dataclasses import dataclass
from typing import TYPE_CHECKING

import numpy as np
from numpy.typing import NDArray
from scipy.optimize import least_squares

from derivlab.engines.fourier import cos_prices
from derivlab.instruments import European, PlainVanilla, VanillaOption
from derivlab.models import SABR, Heston

from .implied_vol import implied_volatility

if TYPE_CHECKING:  # runtime import would be circular: data.cleaning uses implied_volatility
    from derivlab.data import CleanSlice, SurfaceData


@dataclass(frozen=True)
class SliceFit:
    t: float
    forward: float
    strikes: tuple[float, ...]
    market_vols: tuple[float, ...]
    model_vols: tuple[float | None, ...]

    @property
    def rmse(self) -> float:
        errors = [
            m - v for m, v in zip(self.model_vols, self.market_vols, strict=True) if m is not None
        ]
        return float(np.sqrt(np.mean(np.square(errors)))) if errors else float("nan")


@dataclass(frozen=True)
class HestonCalibration:
    model: Heston
    rmse: float
    slices: tuple[SliceFit, ...]
    evaluations: int
    runtime_ms: float


@dataclass(frozen=True)
class SABRCalibration:
    models: tuple[SABR, ...]
    rmse: float
    slices: tuple[SliceFit, ...]
    runtime_ms: float


def _subsample(points: tuple, max_points: int) -> list:
    if len(points) <= max_points:
        return list(points)
    idx = np.unique(np.linspace(0, len(points) - 1, max_points).round().astype(int))
    return [points[i] for i in idx]


def _model_vols(
    sl: CleanSlice, strikes: NDArray[np.float64], kinds: list[str], prices: NDArray[np.float64]
) -> list[float | None]:
    vols: list[float | None] = []
    for strike, kind, price in zip(strikes, kinds, prices, strict=True):
        option = VanillaOption(PlainVanilla(kind, float(strike)), European(sl.t))  # type: ignore[arg-type]
        try:
            vols.append(implied_volatility(float(price), option, sl.market).volatility)
        except ValueError:
            vols.append(None)
    return vols


def calibrate_heston(
    data: SurfaceData, initial: Heston | None = None, max_points_per_slice: int = 25
) -> HestonCalibration:
    start = time.perf_counter()
    slices = []
    for sl in data.slices:
        pts = _subsample(sl.points, max_points_per_slice)
        strikes = np.array([p.strike for p in pts])
        kinds = [p.kind for p in pts]
        prices = np.array([p.price for p in pts])
        vols = np.array([p.implied_vol for p in pts])
        sign = np.where(np.array(kinds) == "call", 1, -1)
        market = sl.market
        # Market vega (per unit volatility) for scaling price errors into volatility errors.
        width = vols * math.sqrt(sl.t)
        d1 = (np.log(sl.forward / strikes) + 0.5 * width**2) / width
        vega = (
            sl.discount
            * sl.forward
            * np.exp(-0.5 * d1 * d1)
            / math.sqrt(2 * math.pi)
            * math.sqrt(sl.t)
        )
        slices.append(
            (sl, strikes, kinds, prices, vols, sign, market, np.maximum(vega, 1e-4 * sl.forward))
        )

    if initial is None:
        short, long = data.slices[0].atm_vol, data.slices[-1].atm_vol
        initial = Heston(v0=short**2, kappa=2.0, theta=long**2, xi=0.5, rho=-0.6)
    x0 = [initial.v0, initial.kappa, initial.theta, initial.xi, initial.rho]
    lower = [1e-4, 0.05, 1e-4, 0.01, -0.99]
    upper = [2.0, 15.0, 2.0, 4.0, 0.9]
    evaluations = 0

    def residuals(x: NDArray[np.float64]) -> NDArray[np.float64]:
        nonlocal evaluations
        evaluations += 1
        model = Heston(*x)
        out = []
        for sl, strikes, _, prices, _, sign, market, vega in slices:
            calls = cos_prices("call", strikes, sl.t, market, model)
            puts = calls - (
                market.spot * math.exp(-market.dividend_yield * sl.t) - strikes * sl.discount
            )
            model_prices = np.where(sign > 0, calls, puts)
            out.append((model_prices - prices) / vega)
        return np.concatenate(out)

    fit = least_squares(residuals, np.clip(x0, lower, upper), bounds=(lower, upper), max_nfev=200)
    model = Heston(*(float(v) for v in fit.x))

    fits = []
    for sl, strikes, kinds, _, vols, sign, market, _ in slices:
        calls = cos_prices("call", strikes, sl.t, market, model)
        puts = calls - (
            market.spot * math.exp(-market.dividend_yield * sl.t) - strikes * sl.discount
        )
        model_prices = np.where(sign > 0, calls, puts)
        fits.append(
            SliceFit(
                sl.t,
                sl.forward,
                tuple(strikes.tolist()),
                tuple(vols.tolist()),
                tuple(_model_vols(sl, strikes, kinds, model_prices)),
            )
        )
    errors = [
        m - v
        for f in fits
        for m, v in zip(f.model_vols, f.market_vols, strict=True)
        if m is not None
    ]
    return HestonCalibration(
        model,
        float(np.sqrt(np.mean(np.square(errors)))),
        tuple(fits),
        evaluations,
        (time.perf_counter() - start) * 1000,
    )


def calibrate_sabr(data: SurfaceData, beta: float = 1.0) -> SABRCalibration:
    start = time.perf_counter()
    models, fits = [], []
    for sl in data.slices:
        strikes = np.array([p.strike for p in sl.points])
        vols = np.array([p.implied_vol for p in sl.points])
        alpha0 = sl.atm_vol * sl.forward ** (1 - beta)

        def residuals(
            x: NDArray[np.float64],
            forward: float = sl.forward,
            t: float = sl.t,
            strikes: NDArray[np.float64] = strikes,
            vols: NDArray[np.float64] = vols,
        ) -> NDArray[np.float64]:
            return SABR(x[0], beta, x[1], x[2]).implied_volatility(forward, strikes, t) - vols

        fit = least_squares(
            residuals,
            [alpha0, -0.5, 0.5],
            bounds=([1e-6, -0.999, 1e-4], [10 * alpha0 + 1, 0.999, 10.0]),
            max_nfev=500,
        )
        model = SABR(float(fit.x[0]), beta, float(fit.x[1]), float(fit.x[2]))
        model_vols = model.implied_volatility(sl.forward, strikes, sl.t)
        models.append(model)
        fits.append(
            SliceFit(
                sl.t,
                sl.forward,
                tuple(strikes.tolist()),
                tuple(vols.tolist()),
                tuple(float(v) for v in model_vols),
            )
        )
    errors = [
        m - v
        for f in fits
        for m, v in zip(f.model_vols, f.market_vols, strict=True)
        if m is not None
    ]
    return SABRCalibration(
        tuple(models),
        float(np.sqrt(np.mean(np.square(errors)))),
        tuple(fits),
        (time.perf_counter() - start) * 1000,
    )
