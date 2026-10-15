"""Library-wide exception types."""


class UnsupportedError(Exception):
    """An engine was asked to price an instrument/model combination it does not support.

    Engines raise this instead of silently approximating, so callers can report
    "not available with this method" rather than show a wrong number.
    """
