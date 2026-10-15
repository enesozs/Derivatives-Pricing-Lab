"""Local volatility: the instantaneous volatility is a deterministic function sigma(S, t).

    dS/S = (r - q) dt + sigma(S, t) dW

Dupire (1994) showed there is exactly one such function that reproduces every European option
price on a (smooth, arbitrage-free) implied-volatility surface. It fits today's smile by
construction, but implies forward smiles that flatten too fast, which is why exotics are often
priced with stochastic-local-volatility models instead.
Reference: Dupire (1994), "Pricing with a Smile", Risk; Gatheral, The Volatility Surface, ch. 1.
"""

from collections.abc import Callable
from dataclasses import dataclass, field

import numpy as np
from numpy.typing import NDArray

#: sigma(spots, t) -> local volatility at each spot, at calendar time t (years from today).
LocalVolFunction = Callable[[NDArray[np.float64], float], NDArray[np.float64]]


@dataclass(frozen=True)
class LocalVol:
    function: LocalVolFunction = field(compare=False)
    #: Short description for labels, e.g. "Dupire from SVI surface".
    name: str = "Local volatility"

    def __call__(self, spots: NDArray[np.float64], t: float) -> NDArray[np.float64]:
        return self.function(np.asarray(spots, dtype=float), t)

    @staticmethod
    def constant(volatility: float) -> "LocalVol":
        """A flat local volatility: identical to Black–Scholes (useful for testing)."""
        return LocalVol(lambda s, t: np.full_like(s, volatility), f"Flat {volatility:.0%}")
