"""Backtest service settings (`NOVA_*`)."""

from functools import lru_cache

from nova_common import Settings
from pydantic import SecretStr


class BacktestSettings(Settings):
    internal_token: SecretStr
    worker_poll_seconds: float = 2.0


@lru_cache(maxsize=1)
def get_backtest_settings() -> BacktestSettings:
    return BacktestSettings()
