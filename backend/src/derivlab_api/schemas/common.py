"""Schemas shared across product families."""

from typing import Literal

from pydantic import BaseModel

from derivlab import Greeks

OptionKind = Literal["call", "put"]
ExerciseStyle = Literal["european", "american"]


class GreeksOut(BaseModel):
    delta: float
    gamma: float
    vega: float
    theta: float
    rho: float

    @classmethod
    def of(cls, g: Greeks | None) -> "GreeksOut | None":
        return None if g is None else cls(**vars(g))
