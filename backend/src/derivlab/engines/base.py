"""The interface every pricing engine implements."""

from typing import Protocol

from derivlab.instruments import VanillaOption
from derivlab.market import Market
from derivlab.models import Model
from derivlab.results import PricingResult


class PricingEngine(Protocol):
    def price(self, option: VanillaOption, market: Market, model: Model) -> PricingResult:
        """Price `option`; raise UnsupportedError if this engine cannot handle it."""
        ...
