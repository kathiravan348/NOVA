"""Request dependencies for the broker service."""

import hashlib
from typing import Annotated

from fastapi import Depends, Request
from nova_common import ApiException
from nova_common.internal import Caller, internal_caller

from nova_broker.crypto import TokenCipher
from nova_broker.kite import KiteClient
from nova_broker.settings import BrokerSettings


def get_settings(request: Request) -> BrokerSettings:
    settings: BrokerSettings = request.app.state.settings
    return settings


AppSettings = Annotated[BrokerSettings, Depends(get_settings)]


def require_caller(request: Request, settings: AppSettings) -> Caller:
    return internal_caller(request, settings.internal_token)


CallerDep = Annotated[Caller, Depends(require_caller)]


def kite_for(request: Request, api_key: str) -> KiteClient:
    """A Kite client with one account's API key (D55), on the app's shared connection pool."""
    return KiteClient(api_key, request.app.state.kite_http)


def get_cipher(settings: AppSettings) -> TokenCipher:
    if settings.broker_token_key is None:
        raise ApiException(500, "internal", "NOVA_BROKER_TOKEN_KEY is not configured")
    return TokenCipher(settings.broker_token_key.get_secret_value())


def state_key(settings: BrokerSettings) -> bytes:
    """HMAC key for login state, derived from the internal token (never used for anything else)."""
    secret = settings.internal_token.get_secret_value().encode("utf-8")
    return hashlib.sha256(b"nova-broker-login-state:" + secret).digest()


Cipher = Annotated[TokenCipher, Depends(get_cipher)]
