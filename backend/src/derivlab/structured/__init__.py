"""Structured products: autocallables, reverse convertibles, cliquets and forward-start
options, variance and volatility swaps. Each is priced from the library's existing models,
path generators and engines; see docs/06-structured.md."""

from .autocallable import (
    Autocallable,
    AutocallableResult,
    price_autocallable,
    price_worst_of_autocallable,
)
from .cliquet import (
    Cliquet,
    CliquetResult,
    ForwardStartOption,
    cliquet_black_scholes,
    forward_start_black_scholes,
    forward_start_monte_carlo,
    price_cliquet,
)
from .reverse_convertible import ReverseConvertible, barrier_hit_probability
from .variance import (
    RealisedVariance,
    VarianceReplication,
    expected_variance,
    replicate_variance,
    simulate_realised_variance,
)

__all__ = [
    "Autocallable",
    "AutocallableResult",
    "Cliquet",
    "CliquetResult",
    "ForwardStartOption",
    "RealisedVariance",
    "ReverseConvertible",
    "VarianceReplication",
    "barrier_hit_probability",
    "cliquet_black_scholes",
    "expected_variance",
    "forward_start_black_scholes",
    "forward_start_monte_carlo",
    "price_autocallable",
    "price_cliquet",
    "price_worst_of_autocallable",
    "replicate_variance",
    "simulate_realised_variance",
]
