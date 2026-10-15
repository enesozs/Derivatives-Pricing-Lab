"""SVI: a five-parameter formula for one expiry's smile, in total implied variance.

    w(k) = a + b ( rho (k - m) + sqrt((k - m)^2 + sigma^2) ),    w = sigma_implied^2 T,  k = ln(K/F)

`a` sets the level, `b` the slope of the wings, `rho` the skew (left/right asymmetry), `m` shifts
the smile sideways and `sigma` rounds off the bottom. It is linear in k in both wings, which
matches what no-arbitrage theory allows (Lee's moment formula), so extrapolation is sensible.

No-arbitrage checks:
- Butterfly (no negative probabilities within one expiry): Durrleman's condition
  g(k) = (1 - k w'/(2w))^2 - (w'^2/4)(1/w + 1/4) + w''/2 >= 0.
- Calendar (option prices increase with maturity): total variance must not decrease with T at
  any fixed k. Checked across slices in surface.py.
Reference: Gatheral, The Volatility Surface (2006); Gatheral & Jacquier (2014), "Arbitrage-free
SVI volatility surfaces", Quantitative Finance 14(1).
"""

import math
from dataclasses import dataclass

import numpy as np
from numpy.typing import ArrayLike, NDArray
from scipy.optimize import least_squares, minimize


@dataclass(frozen=True)
class SVIParams:
    a: float
    b: float
    rho: float
    m: float
    sigma: float

    def total_variance(self, k: ArrayLike) -> NDArray[np.float64]:
        x = np.asarray(k, dtype=float) - self.m
        return self.a + self.b * (self.rho * x + np.sqrt(x * x + self.sigma**2))

    def first_derivative(self, k: ArrayLike) -> NDArray[np.float64]:
        x = np.asarray(k, dtype=float) - self.m
        return self.b * (self.rho + x / np.sqrt(x * x + self.sigma**2))

    def second_derivative(self, k: ArrayLike) -> NDArray[np.float64]:
        x = np.asarray(k, dtype=float) - self.m
        return self.b * self.sigma**2 / (x * x + self.sigma**2) ** 1.5

    def implied_vol(self, k: ArrayLike, t: float) -> NDArray[np.float64]:
        return np.sqrt(np.maximum(self.total_variance(k), 0.0) / t)

    def durrleman(self, k: ArrayLike) -> NDArray[np.float64]:
        """Durrleman's g(k); negative values mean a negative risk-neutral density there."""
        w = self.total_variance(k)
        w1, w2 = self.first_derivative(k), self.second_derivative(k)
        kk = np.asarray(k, dtype=float)
        return (1 - kk * w1 / (2 * w)) ** 2 - (w1 * w1 / 4) * (1 / w + 0.25) + w2 / 2


@dataclass(frozen=True)
class SVIFit:
    params: SVIParams
    #: Root-mean-square error in implied volatility.
    rmse: float
    #: Log-moneyness values where the fitted smile admits butterfly arbitrage.
    butterfly_violations: tuple[float, ...]
    #: Range of log-moneyness covered by the quotes the fit is based on.
    k_range: tuple[float, float] = (-0.5, 0.5)


def _inner_linear_fit(
    k: NDArray[np.float64],
    w_market: NDArray[np.float64],
    weights: NDArray[np.float64],
    m: float,
    sigma: float,
) -> tuple[SVIParams, float]:
    """For fixed (m, sigma), SVI is linear in (a, d = rho b sigma, c = b sigma):
    w = a + d y + c sqrt(y^2 + 1) with y = (k - m) / sigma. Solve it by weighted least squares,
    projecting onto the admissible set |d| <= c (i.e. |rho| <= 1) and c >= 0 when needed."""
    y = (k - m) / sigma
    z = np.sqrt(y * y + 1)
    sw = np.sqrt(weights)

    def solve(columns: list[NDArray[np.float64]]) -> NDArray[np.float64]:
        design = np.column_stack(columns) * sw[:, None]
        return np.linalg.lstsq(design, w_market * sw, rcond=None)[0]

    a, d, c = solve([np.ones_like(y), y, z])
    if c < 0 or abs(d) > c:
        # Optimum outside the domain: it lies on a boundary, d = +c, d = -c or c = 0.
        candidates = []
        for sign in (1.0, -1.0):
            a_s, c_s = solve([np.ones_like(y), sign * y + z])
            if c_s >= 0:
                candidates.append((a_s, sign * c_s, c_s))
        a0 = float(np.average(w_market, weights=weights))
        candidates.append((a0, 0.0, 0.0))
        a, d, c = min(
            candidates,
            key=lambda p: float(np.sum(weights * (p[0] + p[1] * y + p[2] * z - w_market) ** 2)),
        )
    b = max(c / sigma, 0.0)
    rho = float(np.clip(d / c, -0.999, 0.999)) if c > 1e-12 else 0.0
    params = SVIParams(float(a), b, rho, m, sigma)
    error = float(np.sum(weights * (params.total_variance(k) - w_market) ** 2))
    # Penalise negative minimum variance (a + b sigma sqrt(1 - rho^2) < 0).
    min_variance = params.a + params.b * params.sigma * math.sqrt(1 - params.rho**2)
    return params, error + 1e3 * max(-min_variance, 0.0) ** 2


def fit_svi(
    log_moneyness: ArrayLike,
    implied_vols: ArrayLike,
    t: float,
    weights: ArrayLike | None = None,
) -> SVIFit:
    """Fit SVI to one smile with the quasi-explicit method (Zeliade Systems, 2009).

    The inner problem in (a, rho, b) is linear for fixed (m, sigma) and is solved exactly; only
    (m, sigma) are searched numerically (a coarse grid, then Nelder–Mead). This is far more
    robust than a direct 5-parameter fit. A final direct least-squares polish in implied-vol
    space is kept if it improves the fit.

    Weights default to uniform in implied volatility. Strong vega weighting was tried and
    rejected: it lets degenerate shapes (sigma -> 0, |rho| -> 1) fit the centre while ignoring
    the wings. The far wings are already trimmed during cleaning (data/cleaning.py, max_std).
    """
    k = np.asarray(log_moneyness, dtype=float)
    vols = np.asarray(implied_vols, dtype=float)
    if len(k) < 5:
        raise ValueError("SVI needs at least 5 points")
    w_market = vols**2 * t
    wts = np.ones_like(k) if weights is None else np.asarray(weights, dtype=float)
    # Implied-vol errors map to total-variance errors via dw = 2 sigma T d(sigma).
    w_weights = (wts / (2 * vols * t)) ** 2
    span = max(float(k.max() - k.min()), 0.05)

    sigma_min, sigma_max = 0.005, 2.0

    def objective(x: NDArray[np.float64]) -> float:
        m, log_sigma = x
        sigma = min(max(math.exp(log_sigma), sigma_min), sigma_max)
        return _inner_linear_fit(k, w_market, w_weights, m, sigma)[1]

    best_x, best_value = None, math.inf
    for m in np.linspace(k.min(), k.max(), 9):
        for sigma in (0.01, 0.03, 0.1, 0.3, 0.8):
            value = objective(np.array([m, math.log(sigma)]))
            if value < best_value:
                best_x, best_value = np.array([m, math.log(sigma)]), value
    assert best_x is not None
    refined = minimize(
        objective, best_x, method="Nelder-Mead", options={"xatol": 1e-6, "fatol": 1e-14}
    )
    m_opt = float(refined.x[0])
    sigma_opt = min(max(math.exp(float(refined.x[1])), sigma_min), sigma_max)
    quasi_explicit, _ = _inner_linear_fit(k, w_market, w_weights, m_opt, sigma_opt)

    # Direct 5-parameter least squares in implied-vol space, from the quasi-explicit solution
    # and from typical equity shapes; the best of all candidates wins.
    def residuals(p: NDArray[np.float64]) -> NDArray[np.float64]:
        trial = SVIParams(*p)
        model_vol = np.sqrt(np.maximum(trial.total_variance(k), 1e-12) / t)
        min_variance = p[0] + p[1] * p[4] * math.sqrt(max(1 - p[2] ** 2, 0.0))
        return np.append(wts * (model_vol - vols), 10.0 * max(-min_variance, 0.0))

    lower = [-max(w_market.max(), 1e-4), 0.0, -0.999, k.min() - span, sigma_min]
    upper = [max(w_market.max(), 1e-4) * 2, 10.0, 0.999, k.max() + span, sigma_max]
    w_atm = float(np.interp(0.0, k, w_market)) if k.min() < 0 < k.max() else float(w_market.min())
    starts = [
        [
            quasi_explicit.a,
            quasi_explicit.b,
            quasi_explicit.rho,
            quasi_explicit.m,
            quasi_explicit.sigma,
        ]
    ]
    starts += [
        [0.5 * w_atm, 0.1, rho0, 0.0, sigma0]
        for rho0 in (-0.7, -0.3, 0.0)
        for sigma0 in (0.05, 0.2)
    ]
    candidates = [quasi_explicit]
    for x0 in starts:
        fit = least_squares(
            residuals, np.clip(x0, lower, upper), bounds=(lower, upper), max_nfev=1000
        )
        candidates.append(SVIParams(*(float(v) for v in fit.x)))

    def score(c: SVIParams) -> float:
        return float(np.sum(residuals(np.array([c.a, c.b, c.rho, c.m, c.sigma])) ** 2))

    params = min(candidates, key=score)

    model_vol = params.implied_vol(k, t)
    rmse = float(np.sqrt(np.mean((model_vol - vols) ** 2)))  # unweighted, for reporting
    grid = np.linspace(k.min(), k.max(), 201)
    violations = tuple(float(x) for x in grid[params.durrleman(grid) < -1e-8])
    return SVIFit(params, rmse, violations, (float(k.min()), float(k.max())))
