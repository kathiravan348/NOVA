"""Strategy service settings (`NOVA_*`)."""

from functools import lru_cache

from nova_common import Settings
from pydantic import SecretStr


class StrategySettings(Settings):
    internal_token: SecretStr


@lru_cache(maxsize=1)
def get_strategy_settings() -> StrategySettings:
    return StrategySettings()
