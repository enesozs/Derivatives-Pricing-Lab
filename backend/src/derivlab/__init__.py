"""derivlab — a derivatives pricing library.

Instruments (what is traded) + Market (today's observable state) + Model (assumed dynamics)
are priced by an Engine (numerical method). See AGENTS.md §3.
"""

from .core.errors import UnsupportedError
from .engines import AnalyticEngine, CRREngine, MonteCarloEngine, PricingEngine
from .instruments import American, European, PlainVanilla, VanillaOption
from .market import Market
from .models import BlackScholes
from .results import Greeks, PricingResult

__all__ = [
    "American",
    "AnalyticEngine",
    "BlackScholes",
    "CRREngine",
    "European",
    "Greeks",
    "Market",
    "MonteCarloEngine",
    "PlainVanilla",
    "PricingEngine",
    "PricingResult",
    "UnsupportedError",
    "VanillaOption",
]
