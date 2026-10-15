"""The COS method: European option prices from a model's characteristic function.

Many models (Heston, jump-diffusions, Lévy processes) have no closed-form price, but the
characteristic function of the log-return X = ln(S_T/S_0) is known. The COS method (Fang &
Oosterlee 2008) expands the risk-neutral density of y = ln(S_T/K) on a truncated interval
[a, b] in a Fourier-cosine series, whose coefficients come straight from the characteristic
function. The payoff's cosine coefficients are known in closed form, so the price is a short
sum:

    V = e^{-rT} sum'_k Re[ phi(u_k) e^{i u_k (x - a)} ] U_k,   u_k = k pi / (b - a),  x = ln(S0/K)

- Puts are priced directly (their payoff is bounded, so truncation error is small) and calls
  follow from put–call parity.
- [a, b] is set from the first two cumulants of X, estimated numerically from phi:
  [c1 - L sqrt(c2), c1 + L sqrt(c2)] around x, with L = 16. Fang & Oosterlee use L = 10 plus a
  fourth-cumulant term; without it, L = 12 truncates Heston's fat tails at the ~2e-6 level,
  while L = 16 agrees with QuantLib to ~1e-8 at no extra cost.
- Error decays exponentially in the number of terms for smooth densities; 256 terms give
  ~1e-10 for typical equity parameters. Very short expiries (spiky densities) need more.

Vectorised over strikes, so pricing a whole smile costs about as much as one option. That is
what makes calibration fast.
Reference: Fang & Oosterlee (2008), SIAM J. Sci. Comput. 31(2).
"""

import math
from dataclasses import dataclass
from typing import Literal, Protocol

import numpy as np
from numpy.typing import ArrayLike, NDArray

from derivlab.core.errors import UnsupportedError
from derivlab.instruments import Instrument, VanillaOption
from derivlab.market import Market
from derivlab.models import Model
from derivlab.results import PricingResult


class HasCharacteristicFunction(Protocol):
    def characteristic_function(
        self, u: NDArray[np.complex128], t: float, rate: float, dividend_yield: float
    ) -> NDArray[np.complex128]: ...


def _cumulants(
    model: HasCharacteristicFunction, t: float, rate: float, q: float
) -> tuple[float, float]:
    """First two cumulants of X from finite differences of log phi at u = 0."""
    h = 1e-4
    u = np.array([-h, 0.0, h], dtype=complex)
    log_phi = np.log(model.characteristic_function(u, t, rate, q))
    c1 = float((log_phi[2] - log_phi[0]).imag / (2 * h))
    c2 = float(-(log_phi[2] + log_phi[0] - 2 * log_phi[1]).real / h**2)
    return c1, max(c2, 1e-12)


def cos_prices(
    kind: Literal["call", "put"],
    strikes: ArrayLike,
    t: float,
    market: Market,
    model: HasCharacteristicFunction,
    terms: int = 256,
    truncation: float = 16.0,
) -> NDArray[np.float64]:
    """European prices for many strikes at one expiry."""
    k_strikes = np.atleast_1d(np.asarray(strikes, dtype=float))
    r, q, s0 = market.rate, market.dividend_yield, market.spot
    c1, c2 = _cumulants(model, t, r, q)
    half = truncation * math.sqrt(c2)

    x = np.log(s0 / k_strikes)[:, None]  # (strikes, 1)
    a = x + c1 - half
    b = x + c1 + half
    k = np.arange(terms)[None, :]  # (1, terms)
    u = k * math.pi / (b - a)  # (strikes, terms)

    # Put payoff coefficients on [a, 0]: U_k = 2/(b-a) K (psi_k(a, 0) - chi_k(a, 0)).
    d = np.minimum(0.0, b)
    c = a
    chi = (
        np.cos(u * (d - a)) * np.exp(d)
        - np.cos(u * (c - a)) * np.exp(c)
        + u * np.sin(u * (d - a)) * np.exp(d)
        - u * np.sin(u * (c - a)) * np.exp(c)
    ) / (1 + u * u)
    with np.errstate(divide="ignore", invalid="ignore"):
        psi = np.where(
            k == 0, d - c, (np.sin(u * (d - a)) - np.sin(u * (c - a))) / np.where(k == 0, 1, u)
        )
    coefficients = 2 / (b - a) * k_strikes[:, None] * (psi - chi)

    # phi depends on u, which differs per strike row because [a, b] is centred on each x.
    phi = model.characteristic_function(u.astype(complex), t, r, q)
    terms_k = (phi * np.exp(1j * u * (x - a))).real * coefficients
    terms_k[:, 0] *= 0.5  # the first term of a cosine series is halved
    puts = math.exp(-r * t) * terms_k.sum(axis=1)
    puts = np.maximum(puts, 0.0)
    if kind == "put":
        return puts
    forward_gap = s0 * math.exp(-q * t) - k_strikes * math.exp(-r * t)
    return puts + forward_gap


def risk_neutral_density(
    model: HasCharacteristicFunction,
    t: float,
    market: Market,
    spots: ArrayLike,
    terms: int = 256,
    truncation: float = 16.0,
) -> NDArray[np.float64]:
    """Density of S_T at the given spots, recovered from phi by the same cosine expansion."""
    s = np.asarray(spots, dtype=float)
    c1, c2 = _cumulants(model, t, market.rate, market.dividend_yield)
    a = c1 - truncation * math.sqrt(c2)
    b = c1 + truncation * math.sqrt(c2)
    k = np.arange(terms)
    u = k * math.pi / (b - a)
    phi = model.characteristic_function(u.astype(complex), t, market.rate, market.dividend_yield)
    weights = (phi * np.exp(-1j * u * a)).real * 2 / (b - a)
    weights[0] *= 0.5
    x = np.log(s / market.spot)  # log-return at each terminal spot
    density_x = (weights[None, :] * np.cos(np.outer(x - a, u))).sum(axis=1)
    return np.maximum(density_x, 0.0) / s  # change of variables from log-return to price


@dataclass(frozen=True)
class CosEngine:
    terms: int = 256
    truncation: float = 16.0

    @property
    def label(self) -> str:
        return f"COS Fourier · {self.terms} terms"

    def price(self, option: Instrument, market: Market, model: Model) -> PricingResult:
        if not isinstance(option, VanillaOption):
            raise UnsupportedError(
                f"The COS engine prices vanilla options, not {type(option).__name__}"
            )
        if option.is_american:
            raise UnsupportedError("Fourier methods price European exercise only")
        if not hasattr(model, "characteristic_function"):
            raise UnsupportedError(
                f"The {type(model).__name__} model has no characteristic function "
                "for the COS method"
            )
        if option.expiry == 0:
            return PricingResult(float(option.payoff(market.spot)))
        value = cos_prices(
            option.payoff.kind,
            option.payoff.strike,
            option.expiry,
            market,
            model,  # type: ignore[arg-type]  # checked with hasattr above
            self.terms,
            self.truncation,
        )[0]
        return PricingResult(float(value), diagnostics={"terms": self.terms})
