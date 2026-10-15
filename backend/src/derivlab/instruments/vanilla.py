"""Vanilla option: a plain call/put payoff with European or American exercise."""

from dataclasses import dataclass, replace

from .exercise import American, European, Exercise
from .payoffs import PlainVanilla


@dataclass(frozen=True)
class VanillaOption:
    payoff: PlainVanilla
    exercise: Exercise

    @property
    def expiry(self) -> float:
        return self.exercise.expiry

    @property
    def is_american(self) -> bool:
        return isinstance(self.exercise, American)

    def with_expiry(self, expiry: float) -> "VanillaOption":
        """The same contract with a different time to expiry (e.g. after time has passed)."""
        exercise = American(expiry) if self.is_american else European(expiry)
        return replace(self, exercise=exercise)

    def aged(self, elapsed: float) -> "VanillaOption":
        """The contract as seen `elapsed` years from now (expiry floored at zero)."""
        return self.with_expiry(max(self.expiry - elapsed, 0.0))
