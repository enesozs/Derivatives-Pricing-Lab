"""Options on several underlyings, where correlation becomes a pricing input.

Kept as its own package because markets, models and payoffs here are vectors: a separate,
small set of types rather than overloading the single-asset ones.
"""

from .analytic import MultiAssetAnalyticEngine
from .instruments import BasketOption, ExchangeOption, QuantoOption, RainbowOption, SpreadOption
from .market import CorrelatedBlackScholes, MultiAssetMarket, QuantoMarket, QuantoModel
from .montecarlo import MultiAssetMonteCarloEngine, correlated_paths

MultiAssetOption = ExchangeOption | SpreadOption | BasketOption | RainbowOption

__all__ = [
    "BasketOption",
    "CorrelatedBlackScholes",
    "ExchangeOption",
    "MultiAssetAnalyticEngine",
    "MultiAssetMarket",
    "MultiAssetMonteCarloEngine",
    "MultiAssetOption",
    "QuantoMarket",
    "QuantoModel",
    "QuantoOption",
    "RainbowOption",
    "SpreadOption",
    "correlated_paths",
]
