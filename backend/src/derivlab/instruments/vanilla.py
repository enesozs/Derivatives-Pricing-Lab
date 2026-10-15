"""Vanilla option: a plain call/put payoff with European or American exercise."""

from dataclasses import dataclass

from .exercise import American, Exercise
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
