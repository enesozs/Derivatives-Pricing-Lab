"""Payment schedules as year fractions (no calendars: every period is exactly 1/frequency)."""

import numpy as np
from numpy.typing import NDArray


def payment_times(start: float, end: float, frequency: int) -> NDArray[np.float64]:
    """Payment dates (start, end] every 1/frequency years, rolled back from `end`."""
    if frequency < 1 or end <= start:
        raise ValueError("need frequency >= 1 and end > start")
    period = 1.0 / frequency
    n = max(1, round((end - start) * frequency))
    times = (end - period * np.arange(n)[::-1]).astype(np.float64)
    times[0] = max(times[0], start + 1e-9)  # a short first period if the tenor isn't a multiple
    return times


def accruals(start: float, times: NDArray[np.float64]) -> NDArray[np.float64]:
    return np.diff(np.concatenate([[start], times])).astype(np.float64)
