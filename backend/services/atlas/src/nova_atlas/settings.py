"""NOVA Atlas settings (`NOVA_*`)."""

from functools import lru_cache

from nova_common import Settings
from pydantic import SecretStr


class AtlasSettings(Settings):
    internal_token: SecretStr
    # Atlas reaches Kite only through the broker service (D35, D41).
    broker_url: str = "http://broker:8000"
    worker_poll_seconds: float = 2.0


@lru_cache(maxsize=1)
def get_atlas_settings() -> AtlasSettings:
    return AtlasSettings()
