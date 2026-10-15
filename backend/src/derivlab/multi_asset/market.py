"""Markets and models for several correlated assets, and for quantos."""

import math
from dataclasses import dataclass

import numpy as np
from numpy.typing import NDArray


@dataclass(frozen=True)
class MultiAssetMarket:
    spots: tuple[float, ...]
    rate: float
    dividend_yields: tuple[float, ...]

    def __post_init__(self) -> None:
        if len(self.spots) < 2 or len(self.spots) != len(self.dividend_yields):
            raise ValueError("need at least two assets and one dividend yield per asset")
        if any(s <= 0 or not math.isfinite(s) for s in self.spots):
            raise ValueError("spots must be positive")
        if not math.isfinite(self.rate):
            raise ValueError("rate must be finite")

    @property
    def size(self) -> int:
        return len(self.spots)

    def forwards(self, t: float) -> NDArray[np.float64]:
        s, q = np.array(self.spots), np.array(self.dividend_yields)
        return s * np.exp((self.rate - q) * t)

    def discount(self, t: float) -> float:
        return math.exp(-self.rate * t)


@dataclass(frozen=True)
class CorrelatedBlackScholes:
    """Each asset follows GBM with its own volatility; Brownian motions are correlated."""

    volatilities: tuple[float, ...]
    #: Full correlation matrix, row by row.
    correlation: tuple[tuple[float, ...], ...]

    def __post_init__(self) -> None:
        n = len(self.volatilities)
        corr = np.array(self.correlation, dtype=float)
        if corr.shape != (n, n):
            raise ValueError("correlation must be an n x n matrix")
        if any(v <= 0 or not math.isfinite(v) for v in self.volatilities):
            raise ValueError("volatilities must be positive")
        if not np.allclose(corr, corr.T) or not np.allclose(np.diag(corr), 1.0):
            raise ValueError("correlation must be symmetric with a unit diagonal")
        if np.any(np.abs(corr) > 1):
            raise ValueError("correlations must lie in [-1, 1]")
        if np.linalg.eigvalsh(corr).min() < -1e-10:
            raise ValueError("correlation matrix is not positive semi-definite")

    @staticmethod
    def uniform(volatilities: tuple[float, ...], rho: float) -> "CorrelatedBlackScholes":
        """Every pair has the same correlation rho (needs rho >= -1/(n-1))."""
        n = len(volatilities)
        corr = tuple(tuple(1.0 if i == j else rho for j in range(n)) for i in range(n))
        return CorrelatedBlackScholes(volatilities, corr)

    @property
    def matrix(self) -> NDArray[np.float64]:
        return np.array(self.correlation, dtype=float)

    def covariance(self, t: float) -> NDArray[np.float64]:
        vols = np.array(self.volatilities)
        return np.outer(vols, vols) * self.matrix * t

    def cholesky(self) -> NDArray[np.float64]:
        # A tiny ridge keeps perfectly correlated (singular) matrices factorisable.
        return np.linalg.cholesky(self.matrix + 1e-12 * np.eye(len(self.volatilities)))


@dataclass(frozen=True)
class QuantoMarket:
    """A foreign asset quoted in foreign currency, and the two currencies' rates."""

    spot: float
    domestic_rate: float
    foreign_rate: float
    dividend_yield: float = 0.0

    def __post_init__(self) -> None:
        if self.spot <= 0:
            raise ValueError("spot must be positive")


@dataclass(frozen=True)
class QuantoModel:
    asset_volatility: float
    fx_volatility: float
    #: Correlation between the asset and the FX rate (domestic per unit of foreign currency).
    correlation: float

    def __post_init__(self) -> None:
        if self.asset_volatility <= 0 or self.fx_volatility < 0:
            raise ValueError("volatilities must be positive")
        if not -1 <= self.correlation <= 1:
            raise ValueError("correlation must lie in [-1, 1]")
