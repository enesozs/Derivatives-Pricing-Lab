"""Short-rate models: the whole curve is driven by one random instantaneous rate r(t).

Vasicek (1977):     dr = a (b - r) dt + sigma dW
Hull–White (1990):  dr = (theta(t) - a r) dt + sigma dW, with theta(t) chosen so today's curve
                    is reproduced exactly.
Both are Gaussian, so zero-coupon bonds are P(t, T) = A(t, T) exp(-B(t, T) r(t)) with
B = (1 - exp(-a (T - t))) / a, and options on bonds have Black-like closed forms (Jamshidian
1989). A caplet is a put on a zero-coupon bond, and a swaption is a put on a coupon bond,
which Jamshidian's trick splits into a sum of zero-coupon bond puts.
`a` is the mean-reversion speed (it damps long-dated volatility); sigma is the rate
volatility in absolute units (0.01 = 100bp a year). Rates can go negative: a feature for
modern markets, a flaw in the 1990s.
Vasicek has constant parameters and cannot fit an arbitrary curve. Hull–White fits it by
construction, which is why practitioners use Hull–White for pricing.
References: Brigo & Mercurio, Interest Rate Models, ch. 3; Hull ch. 32.
"""

import math
from dataclasses import dataclass

import numpy as np
from numpy.typing import ArrayLike, NDArray
from scipy.optimize import least_squares

from derivlab.core.roots import find_root
from derivlab.core.stats import norm_cdf as N

from .curve import DiscountCurve
from .options import CapFloor, Swaption, implied_vol
from .schedule import accruals, payment_times


def _b(a: float, tau: ArrayLike) -> NDArray[np.float64]:
    return (1 - np.exp(-a * np.asarray(tau, dtype=float))) / a


def _bond_option(p_t: float, p_s: float, strike: float, sigma_p: float, call: bool) -> float:
    """Jamshidian: option at T on a bond maturing at S, given today's P(0,T), P(0,S)."""
    if sigma_p <= 0:
        return max(p_s - strike * p_t, 0.0) if call else max(strike * p_t - p_s, 0.0)
    h = math.log(p_s / (p_t * strike)) / sigma_p + 0.5 * sigma_p
    if call:
        return p_s * N(h) - strike * p_t * N(h - sigma_p)
    return strike * p_t * N(-h + sigma_p) - p_s * N(-h)


@dataclass(frozen=True)
class Vasicek:
    a: float
    b: float
    sigma: float
    r0: float

    def __post_init__(self) -> None:
        if self.a <= 0 or self.sigma < 0:
            raise ValueError("need a > 0 and sigma >= 0")

    def discount(self, t: ArrayLike) -> NDArray[np.float64]:
        tau = np.asarray(t, dtype=float)
        bb = _b(self.a, tau)
        log_a = (self.b - self.sigma**2 / (2 * self.a**2)) * (bb - tau) - self.sigma**2 * bb**2 / (
            4 * self.a
        )
        return np.exp(log_a - bb * self.r0)

    def curve(self, horizon: float = 30.0, points: int = 120) -> DiscountCurve:
        times = np.linspace(horizon / points, horizon, points)
        return DiscountCurve(tuple(times.tolist()), tuple(self.discount(times).tolist()))

    def bond_option(self, expiry: float, maturity: float, strike: float, call: bool) -> float:
        sigma_p = (
            self.sigma
            * float(_b(self.a, maturity - expiry))
            * math.sqrt((1 - math.exp(-2 * self.a * expiry)) / (2 * self.a))
        )
        return _bond_option(
            float(self.discount(expiry)), float(self.discount(maturity)), strike, sigma_p, call
        )

    def simulate(
        self, horizon: float, steps: int, paths: int, seed: int = 42
    ) -> NDArray[np.float64]:
        """Short-rate paths (exact OU transition), shape (paths, steps + 1)."""
        rng = np.random.default_rng(seed)
        dt = horizon / steps
        decay = math.exp(-self.a * dt)
        sd = self.sigma * math.sqrt((1 - decay**2) / (2 * self.a))
        r = np.empty((paths, steps + 1))
        r[:, 0] = self.r0
        for i in range(steps):
            r[:, i + 1] = self.b + (r[:, i] - self.b) * decay + sd * rng.standard_normal(paths)
        return r


@dataclass(frozen=True)
class HullWhite:
    a: float
    sigma: float
    curve: DiscountCurve

    def __post_init__(self) -> None:
        if self.a <= 0 or self.sigma < 0:
            raise ValueError("need a > 0 and sigma >= 0")

    def _sigma_p(self, expiry: float, maturity: float) -> float:
        return (
            self.sigma
            * float(_b(self.a, maturity - expiry))
            * math.sqrt((1 - math.exp(-2 * self.a * expiry)) / (2 * self.a))
        )

    def bond_option(self, expiry: float, maturity: float, strike: float, call: bool) -> float:
        return _bond_option(
            self.curve.df(expiry),
            self.curve.df(maturity),
            strike,
            self._sigma_p(expiry, maturity),
            call,
        )

    def bond_price(self, t: float, maturity: ArrayLike, r: ArrayLike) -> NDArray[np.float64]:
        """P(t, T | r(t) = r), consistent with today's curve."""
        tt = np.asarray(maturity, dtype=float)
        bb = _b(self.a, tt - t)
        f = (
            float(self.curve.instantaneous_forward(t))
            if t > 0
            else float(self.curve.zero_rate(1e-4))
        )
        log_a = (
            np.log(self.curve.discount(tt) / (self.curve.df(t) if t > 0 else 1.0))
            + bb * f
            - self.sigma**2 / (4 * self.a) * (1 - math.exp(-2 * self.a * t)) * bb**2
        )
        return np.exp(log_a - bb * np.asarray(r, dtype=float))

    def cap_price(self, cap: CapFloor) -> float:
        """Each caplet = (1 + K tau) puts on the zero bond P(T_fix, T_pay), strike 1/(1 + K tau)."""
        times = payment_times(0.0, cap.maturity, cap.frequency)
        tau = accruals(0.0, times)
        total = 0.0
        for i in range(1, len(times)):
            factor = 1 + cap.strike * tau[i]
            total += (
                cap.notional
                * factor
                * self.bond_option(times[i - 1], times[i], 1 / factor, call=not cap.cap)
            )
        return total

    def swaption_price(self, swaption: Swaption) -> float:
        """Jamshidian: a payer swaption is a put on a coupon bond; split it into zero-bond puts."""
        t0 = swaption.expiry
        times, tau = swaption.schedule()
        coupons = swaption.strike * tau
        coupons[-1] += 1.0

        def bond(r: float) -> float:
            return float(coupons @ self.bond_price(t0, times, r))

        r_star = find_root(lambda r: bond(r) - 1.0, -1.0, 1.0, xtol=1e-14)
        strikes = self.bond_price(t0, times, r_star)
        put = swaption.payer  # payer swaption = put on the coupon bond
        total = sum(
            c * self.bond_option(t0, t, float(x), call=not put)
            for c, t, x in zip(coupons, times, strikes, strict=True)
        )
        return swaption.notional * float(total)

    def alpha(self, t: ArrayLike) -> NDArray[np.float64]:
        """Deterministic shift: r(t) = x(t) + alpha(t), with x an OU process started at 0."""
        tt = np.asarray(t, dtype=float)
        return (
            self.curve.instantaneous_forward(np.maximum(tt, 1e-4))
            + self.sigma**2 / (2 * self.a**2) * (1 - np.exp(-self.a * tt)) ** 2
        )

    def simulate(
        self, horizon: float, steps: int, paths: int, seed: int = 42
    ) -> NDArray[np.float64]:
        rng = np.random.default_rng(seed)
        dt = horizon / steps
        decay = math.exp(-self.a * dt)
        sd = self.sigma * math.sqrt((1 - decay**2) / (2 * self.a))
        x = np.zeros((paths, steps + 1))
        for i in range(steps):
            x[:, i + 1] = x[:, i] * decay + sd * rng.standard_normal(paths)
        return x + self.alpha(np.linspace(0, horizon, steps + 1))


@dataclass(frozen=True)
class HullWhiteCalibration:
    model: HullWhite
    maturities: tuple[float, ...]
    market_vols: tuple[float, ...]
    model_vols: tuple[float, ...]
    rmse: float


def calibrate_hull_white_to_caps(
    curve: DiscountCurve,
    maturities: list[float],
    black_vols: list[float],
    frequency: int = 4,
) -> HullWhiteCalibration:
    """Fit (a, sigma) so Hull–White reproduces at-the-money cap prices quoted as flat Black vols."""
    caps = []
    for m, vol in zip(maturities, black_vols, strict=True):
        strike = _atm_cap_strike(curve, m, frequency)
        cap = CapFloor(strike, m, frequency, notional=1.0)
        caps.append((cap, cap.price(curve, vol)))

    def residuals(x: np.ndarray) -> np.ndarray:
        model = HullWhite(x[0], x[1], curve)
        return np.array([(model.cap_price(c) - p) / p for c, p in caps])

    fit = least_squares(residuals, [0.05, 0.01], bounds=([1e-3, 1e-4], [2.0, 0.1]))
    model = HullWhite(float(fit.x[0]), float(fit.x[1]), curve)
    model_vols = []
    for cap, _ in caps:
        target = model.cap_price(cap)
        model_vols.append(find_root(lambda v, c=cap, p=target: c.price(curve, v) - p, 1e-4, 3.0))
    errors = np.array(model_vols) - np.array(black_vols)
    return HullWhiteCalibration(
        model,
        tuple(maturities),
        tuple(black_vols),
        tuple(model_vols),
        float(np.sqrt(np.mean(errors**2))),
    )


def _atm_cap_strike(curve: DiscountCurve, maturity: float, frequency: int) -> float:
    """The swap rate over the cap's caplet periods: the at-the-money cap strike."""
    times = payment_times(0.0, maturity, frequency)
    tau = accruals(0.0, times)
    annuity = float((tau[1:] * curve.discount(times[1:])).sum())
    return (curve.df(times[0]) - curve.df(times[-1])) / annuity


__all__ = [
    "HullWhite",
    "HullWhiteCalibration",
    "Vasicek",
    "calibrate_hull_white_to_caps",
    "implied_vol",
]
