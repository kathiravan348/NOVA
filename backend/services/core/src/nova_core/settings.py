"""NOVA Core settings (`NOVA_*` environment variables, D38)."""

from functools import lru_cache

from nova_common import Settings
from pydantic import SecretStr


class CoreSettings(Settings):
    internal_token: SecretStr
    session_hours: int = 12
    # False only for local http; the VPS serves https (Phase 3 plan).
    cookie_secure: bool = False
    broker_url: str | None = None
    atlas_url: str | None = None
    strategy_url: str | None = None
    backtest_url: str | None = None


@lru_cache(maxsize=1)
def get_core_settings() -> CoreSettings:
    return CoreSettings()
