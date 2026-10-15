"""Bivariate standard normal CDF to ~1e-15, by Genz's (2004) algorithm.

SciPy's multivariate_normal.cdf is accurate only to ~1e-5, which is too coarse to check
two-asset closed forms against QuantLib. Genz uses Gauss–Legendre quadrature on Drezner and
Wesolowsky's (1990) formula, with more points as |rho| grows, and a separate expansion for
|rho| > 0.925 where the integrand becomes nearly singular.
Reference: Genz (2004), "Numerical computation of rectangular bivariate and trivariate normal
and t probabilities", Statistics and Computing 14.
"""

import math

import numpy as np

from .stats import norm_cdf

_W = {
    3: np.array([0.1713244923791705, 0.3607615730481384, 0.4679139345726904]),
    6: np.array(
        [
            0.04717533638651177,
            0.1069393259953183,
            0.1600783285433464,
            0.2031674267230659,
            0.2334925365383547,
            0.2491470458134029,
        ]
    ),
    10: np.array(
        [
            0.01761400713915212,
            0.04060142980038694,
            0.06267204833410906,
            0.08327674157670475,
            0.1019301198172404,
            0.1181945319615184,
            0.1316886384491766,
            0.1420961093183821,
            0.1491729864726037,
            0.1527533871307259,
        ]
    ),
}
_X = {
    3: np.array([0.9324695142031522, 0.6612093864662647, 0.2386191860831970]),
    6: np.array(
        [
            0.9815606342467191,
            0.9041172563704750,
            0.7699026741943050,
            0.5873179542866171,
            0.3678314989981802,
            0.1252334085114692,
        ]
    ),
    10: np.array(
        [
            0.9931285991850949,
            0.9639719272779138,
            0.9122344282513259,
            0.8391169718222188,
            0.7463319064601508,
            0.6360536807265150,
            0.5108670019508271,
            0.3737060887154196,
            0.2277858511416451,
            0.07652652113349733,
        ]
    ),
}


def _upper(h: float, k: float, r: float) -> float:
    """P(X > h, Y > k) for standard normals with correlation r."""
    if math.isinf(h) or math.isinf(k):
        if h == math.inf or k == math.inf:
            return 0.0
        if h == -math.inf:
            return 1.0 if k == -math.inf else norm_cdf(-k)
        return norm_cdf(-h)
    n = 3 if abs(r) < 0.3 else 6 if abs(r) < 0.75 else 10
    w = np.concatenate([_W[n], _W[n]])
    x = np.concatenate([1 - _X[n], 1 + _X[n]])
    hk = h * k
    if abs(r) < 0.925:
        hs = (h * h + k * k) / 2
        asr = math.asin(r) / 2
        sn = np.sin(asr * x)
        bvn = float(np.exp((sn * hk - hs) / (1 - sn * sn)) @ w)
        return bvn * asr / (2 * math.pi) + norm_cdf(-h) * norm_cdf(-k)

    if r < 0:
        k, hk = -k, -hk
    bvn = 0.0
    if abs(r) < 1:
        a_s = (1 - r) * (1 + r)
        a = math.sqrt(a_s)
        bs = (h - k) ** 2
        c = (4 - hk) / 8
        d = (12 - hk) / 16
        asr = -(bs / a_s + hk) / 2
        if asr > -100:
            bvn = (
                a
                * math.exp(asr)
                * (1 - c * (bs - a_s) * (1 - d * bs / 5) / 3 + c * d * a_s * a_s / 5)
            )
        if hk > -100:
            b = math.sqrt(bs)
            sp = math.sqrt(2 * math.pi) * norm_cdf(-b / a)
            bvn -= math.exp(-hk / 2) * sp * b * (1 - c * bs * (1 - d * bs / 5) / 3)
        a /= 2
        xs = (a * x) ** 2
        asr_v = -(bs / xs + hk) / 2
        keep = asr_v > -100
        xs, asr_v, wk = xs[keep], asr_v[keep], w[keep]
        sp_v = 1 + c * xs * (1 + d * xs)
        rs = np.sqrt(1 - xs)
        ep = np.exp(-hk * xs / (2 * (1 + rs) ** 2)) / rs
        bvn = (a * float(np.sum(np.exp(asr_v) * (sp_v - ep) * wk)) - bvn) / (2 * math.pi)
    if r > 0:
        return bvn + norm_cdf(-max(h, k))
    if h >= k:
        return -bvn
    lower = norm_cdf(k) - norm_cdf(h) if h < 0 else norm_cdf(-h) - norm_cdf(-k)
    return lower - bvn


def bivariate_normal_cdf(a: float, b: float, rho: float) -> float:
    """P(X <= a, Y <= b) for standard normals X, Y with correlation rho."""
    return min(max(_upper(-a, -b, rho), 0.0), 1.0)
