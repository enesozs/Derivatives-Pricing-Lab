from .exercise import American, European, Exercise
from .exotic import AsianOption, BarrierOption, DigitalOption, Exotic, LookbackOption
from .payoffs import OptionKind, PlainVanilla
from .vanilla import VanillaOption

#: Everything an engine may be asked to price.
Instrument = VanillaOption | Exotic

__all__ = [
    "American",
    "AsianOption",
    "BarrierOption",
    "DigitalOption",
    "European",
    "Exercise",
    "Exotic",
    "Instrument",
    "LookbackOption",
    "OptionKind",
    "PlainVanilla",
    "VanillaOption",
]
