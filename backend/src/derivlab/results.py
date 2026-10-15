"""Engine outputs."""

from dataclasses import dataclass, field


@dataclass(frozen=True)
class Greeks:
    """Price sensitivities in library units.

    delta: dV/dS            gamma: d2V/dS2
    vega:  dV/dsigma per 1.0 (= 100 vol points)
    theta: dV/dt per year of calendar time (negative = value decays)
    rho:   dV/dr per 1.0 (= 100 rate points)
    """

    delta: float
    gamma: float
    vega: float
    theta: float
    rho: float


@dataclass(frozen=True)
class PricingResult:
    value: float
    stderr: float | None = None
    greeks: Greeks | None = None
    diagnostics: dict[str, float | int | str] = field(default_factory=dict)

    def confidence_interval(self, z: float = 1.96) -> tuple[float, float] | None:
        """Normal-approximation interval for stochastic engines; None for deterministic ones."""
        if self.stderr is None:
            return None
        return self.value - z * self.stderr, self.value + z * self.stderr
