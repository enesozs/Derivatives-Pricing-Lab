"""Multi-asset and quanto schemas."""

from typing import Literal

from pydantic import BaseModel, Field, model_validator

from .common import OptionKind

Product = Literal["exchange", "spread", "basket", "best_of", "worst_of"]


class AssetIn(BaseModel):
    spot: float = Field(100.0, gt=0)
    volatility: float = Field(0.25, gt=0, le=2)
    dividend_yield: float = Field(0.0, ge=0, le=0.5)


class MultiAssetRequest(BaseModel):
    product: Product = "basket"
    kind: OptionKind = "call"
    strike: float = Field(100.0, ge=0)
    expiry: float = Field(1.0, gt=0, le=10)
    rate: float = Field(0.05, ge=-0.1, le=0.5)
    assets: list[AssetIn] = Field(
        default_factory=lambda: [
            AssetIn(spot=100, volatility=0.25, dividend_yield=0.0),
            AssetIn(spot=100, volatility=0.30, dividend_yield=0.0),
        ],
        min_length=2,
        max_length=5,
    )
    #: Same correlation for every pair of assets.
    correlation: float = Field(0.4, ge=-1, le=1)
    mc_paths: int = Field(100_000, ge=5_000, le=500_000)
    seed: int = 42

    @model_validator(mode="after")
    def check(self) -> "MultiAssetRequest":
        n = len(self.assets)
        if self.correlation < -1 / (n - 1) + 1e-9:
            raise ValueError(
                f"with {n} assets a uniform correlation must be at least {-1 / (n - 1):.3f}"
            )
        if self.product in ("exchange", "spread") and n != 2:
            raise ValueError("exchange and spread options need exactly two assets")
        return self


class MethodOut(BaseModel):
    label: str
    status: Literal["ok", "unsupported", "error"]
    value: float | None = None
    stderr: float | None = None
    runtime_ms: float | None = None
    note: str | None = None


class MultiAssetResponse(BaseModel):
    value: float
    value_label: str
    methods: list[MethodOut]
    #: dV / d(rho) per 1.0 change in the uniform correlation.
    correlation_sensitivity: float
    correlation_grid: list[float]
    correlation_values: list[float]
    correlation_engine: str
    #: Simulated terminal log-returns of assets 1 and 2, and whether each scenario pays.
    scatter_x: list[float]
    scatter_y: list[float]
    scatter_pays: list[bool]


class QuantoRequest(BaseModel):
    kind: OptionKind = "call"
    strike: float = Field(100.0, gt=0)
    expiry: float = Field(1.0, gt=0, le=10)
    spot: float = Field(100.0, gt=0)
    domestic_rate: float = Field(0.05, ge=-0.1, le=0.5)
    foreign_rate: float = Field(0.02, ge=-0.1, le=0.5)
    dividend_yield: float = Field(0.01, ge=0, le=0.5)
    asset_volatility: float = Field(0.25, gt=0, le=2)
    fx_volatility: float = Field(0.12, ge=0, le=1)
    correlation: float = Field(0.4, ge=-1, le=1)
    fixed_fx: float = Field(1.0, gt=0)
    mc_paths: int = Field(100_000, ge=5_000, le=500_000)


class QuantoResponse(BaseModel):
    value: float
    mc_value: float
    mc_stderr: float
    #: Same contract with zero asset–FX correlation (no quanto drift adjustment).
    uncorrelated_value: float
    #: Drift shift applied to the foreign asset: -rho sigma_S sigma_FX.
    drift_adjustment: float
    correlation_grid: list[float]
    correlation_values: list[float]
