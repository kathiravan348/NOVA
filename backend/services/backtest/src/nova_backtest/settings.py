"""Backtest service settings (`NOVA_*`)."""

from functools import lru_cache

from nova_common import Settings
from pydantic import Field, SecretStr


class BacktestSettings(Settings):
    internal_token: SecretStr
    worker_poll_seconds: float = 2.0
    # D59: price bars one run may load (warm-up included); keeps the worker inside its memory limit.
    # Measured peaks: visual 1.4 M bars ≈ 0.8 GB; Python 735 k ≈ 1.1 GB (the sandbox copies bars).
    backtest_max_bars: int = Field(1_500_000, gt=0)
    backtest_max_bars_python: int = Field(750_000, gt=0)


@lru_cache(maxsize=1)
def get_backtest_settings() -> BacktestSettings:
    return BacktestSettings()
