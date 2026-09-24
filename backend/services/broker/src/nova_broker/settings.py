"""Broker service settings (`NOVA_*`). Kite values are optional: the service starts without them."""

from datetime import date, time
from functools import lru_cache

from nova_common import Settings
from pydantic import SecretStr


class BrokerSettings(Settings):
    internal_token: SecretStr
    kite_api_key: SecretStr | None = None
    kite_api_secret: SecretStr | None = None
    # Fernet key (urlsafe base64 of 32 bytes) that encrypts access tokens at rest (D39).
    broker_token_key: SecretStr | None = None
    # The redirect URL registered in the Kite developer console. It must reach
    # GET /broker/kite/callback on the origin that holds the session cookie (Relay proxies /api).
    kite_redirect_url: str = "http://localhost:3001/api/v1/broker/kite/callback"
    kite_plan: str = "Kite Connect (paid, monthly)"
    kite_renews_on: date | None = None
    kite_postback_url: str | None = None
    kite_static_ip: str | None = None
    # Where the browser returns after the Kite login.
    relay_url: str = "http://localhost:3001"
    # When Kite's per-day limits reset (IST). Not documented by Kite: 00:00 until confirmed (D40).
    kite_daily_reset: time = time(0, 0)


@lru_cache(maxsize=1)
def get_broker_settings() -> BrokerSettings:
    return BrokerSettings()
