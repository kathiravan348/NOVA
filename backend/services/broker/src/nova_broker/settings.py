"""Broker service settings (`NOVA_*`). Kite values are optional: the service starts without them."""

from datetime import time
from functools import lru_cache

from nova_common import Settings
from pydantic import SecretStr


class BrokerSettings(Settings):
    internal_token: SecretStr
    kite_api_key: SecretStr | None = None
    kite_api_secret: SecretStr | None = None
    # Fernet key (urlsafe base64 of 32 bytes) that encrypts access tokens at rest (D39).
    broker_token_key: SecretStr | None = None
    # Where the browser returns after the Kite login. The Kite redirect URL is derived from it:
    # `{relay_url}/api/v1/broker/kite/callback` (Relay proxies /api to NOVA Core; D55).
    relay_url: str = "http://localhost:3001"
    # When Kite's per-day limits reset (IST). Not documented by Kite: 00:00 until confirmed (D40).
    kite_daily_reset: time = time(0, 0)


@lru_cache(maxsize=1)
def get_broker_settings() -> BrokerSettings:
    return BrokerSettings()
