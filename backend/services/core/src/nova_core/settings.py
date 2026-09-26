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
    # WebSocket (D57): keep-alive ping and how often a socket re-checks its session.
    ws_ping_seconds: float = 25.0
    ws_session_check_seconds: float = 60.0


@lru_cache(maxsize=1)
def get_core_settings() -> CoreSettings:
    return CoreSettings()
