"""Models describe how the underlying is assumed to move (risk-neutral dynamics)."""

from .black_scholes import BlackScholes
from .heston import Heston
from .local_vol import LocalVol, LocalVolFunction
from .merton import Merton
from .sabr import SABR

#: Every model an engine may be asked to price with; engines raise UnsupportedError otherwise.
Model = BlackScholes | Heston | Merton | SABR | LocalVol

__all__ = ["SABR", "BlackScholes", "Heston", "LocalVol", "LocalVolFunction", "Merton", "Model"]
