"""Signed login state (D39): `account_id.expiry.signature`; no forged or late callbacks."""

import hashlib
import hmac
import time

LIFETIME_SECONDS = 600


def _signature(key: bytes, payload: str) -> str:
    return hmac.new(key, payload.encode("utf-8"), hashlib.sha256).hexdigest()


def sign(key: bytes, account_id: str, now: float | None = None) -> str:
    expires = int((now if now is not None else time.time()) + LIFETIME_SECONDS)
    payload = f"{account_id}.{expires}"
    return f"{payload}.{_signature(key, payload)}"


def verify(key: bytes, state: str, now: float | None = None) -> str | None:
    """The account id, or None when the state is malformed, forged or expired."""
    parts = state.rsplit(".", 2)
    if len(parts) != 3:
        return None
    account_id, expires, signature = parts
    if not hmac.compare_digest(signature, _signature(key, f"{account_id}.{expires}")):
        return None
    if not expires.isdigit() or int(expires) < (now if now is not None else time.time()):
        return None
    return account_id
