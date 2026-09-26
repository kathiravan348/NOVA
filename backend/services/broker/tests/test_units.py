"""Kite client, login state, token cipher and session rules, without a database."""

import hashlib
from datetime import UTC, datetime
from urllib.parse import parse_qs, urlparse

import httpx2
import pytest
from nova_broker import login_state
from nova_broker.crypto import TokenCipher, new_key
from nova_broker.kite import KiteClient, KiteError, kite_http
from nova_broker.sessions import expiry_after, status_of
from nova_db.models import BrokerSession


def _client(handler: httpx2.MockTransport) -> KiteClient:
    return KiteClient("key1", kite_http(handler))


def test_login_url_carries_the_key_and_state() -> None:
    url = urlparse(_client(httpx2.MockTransport(lambda r: httpx2.Response(500))).login_url("s.1.x"))
    query = parse_qs(url.query)

    assert url.netloc == "kite.zerodha.com"
    assert query["api_key"] == ["key1"] and query["v"] == ["3"]
    assert parse_qs(query["redirect_params"][0]) == {"state": ["s.1.x"]}


def test_exchange_sends_the_checksum_and_version_header() -> None:
    seen: list[httpx2.Request] = []

    def handle(request: httpx2.Request) -> httpx2.Response:
        seen.append(request)
        data = {"user_id": "AB1234", "access_token": "tok", "login_time": "2026-09-24 09:15:00"}
        return httpx2.Response(200, json={"status": "success", "data": data})

    session = _client(httpx2.MockTransport(handle)).exchange("req1", "secret1")

    form = parse_qs(seen[0].content.decode())
    assert form["checksum"] == [hashlib.sha256(b"key1req1secret1").hexdigest()]
    assert form["api_key"] == ["key1"] and form["request_token"] == ["req1"]
    assert seen[0].method == "POST" and seen[0].url.path == "/session/token"
    assert seen[0].headers["x-kite-version"] == "3"
    assert session.access_token == "tok"
    assert session.login_time == datetime(2026, 9, 24, 3, 45, tzinfo=UTC)


@pytest.mark.parametrize(
    "response",
    [
        httpx2.Response(403, json={"status": "error", "message": "Token is invalid"}),
        httpx2.Response(200, text="not json"),
        httpx2.Response(200, json={"status": "success", "data": {"user_id": "x"}}),
    ],
)
def test_kite_errors_become_kite_error(response: httpx2.Response) -> None:
    with pytest.raises(KiteError):
        _client(httpx2.MockTransport(lambda r: response)).exchange("req1", "secret1")


def test_network_failure_becomes_kite_error() -> None:
    def refuse(request: httpx2.Request) -> httpx2.Response:
        raise httpx2.ConnectError("refused", request=request)

    with pytest.raises(KiteError, match="could not be reached"):
        _client(httpx2.MockTransport(refuse)).exchange("req1", "secret1")


def test_kite_client_has_no_order_code() -> None:
    """D35 and AGENTS §10: no order-placement client code exists in Phase 1."""
    assert not [name for name in dir(KiteClient) if "order" in name.lower()]


def test_login_state_round_trip_and_rejections() -> None:
    key = b"k" * 32
    state = login_state.sign(key, "brk_1", now=1000)

    assert login_state.verify(key, state, now=1000) == "brk_1"
    assert login_state.verify(key, state, now=1000 + login_state.LIFETIME_SECONDS + 1) is None
    assert login_state.verify(b"x" * 32, state, now=1000) is None
    assert login_state.verify(key, state.replace("brk_1", "brk_2"), now=1000) is None
    assert login_state.verify(key, "garbage", now=1000) is None


def test_cipher_round_trip_and_wrong_key() -> None:
    cipher = TokenCipher(new_key())
    sealed = cipher.encrypt("access-token")

    assert b"access-token" not in sealed
    assert cipher.decrypt(sealed) == "access-token"
    with pytest.raises(ValueError):
        TokenCipher(new_key()).decrypt(sealed)


@pytest.mark.parametrize(
    ("login", "expires"),
    [
        (datetime(2026, 9, 24, 3, 45, tzinfo=UTC), datetime(2026, 9, 25, 0, 30, tzinfo=UTC)),
        (datetime(2026, 9, 23, 20, 0, tzinfo=UTC), datetime(2026, 9, 24, 0, 30, tzinfo=UTC)),
        (datetime(2026, 9, 24, 0, 30, tzinfo=UTC), datetime(2026, 9, 25, 0, 30, tzinfo=UTC)),
    ],
    ids=["09:15 IST", "01:30 IST", "exactly 06:00 IST"],
)
def test_token_expires_at_the_next_0600_ist(login: datetime, expires: datetime) -> None:
    assert expiry_after(login) == expires


def test_status_is_derived_from_the_expiry() -> None:
    now = datetime(2026, 9, 24, 12, tzinfo=UTC)
    live = BrokerSession(account_id="a", expires_at=datetime(2026, 9, 25, tzinfo=UTC))
    old = BrokerSession(account_id="a", expires_at=datetime(2026, 9, 24, tzinfo=UTC))

    assert status_of(None, now) == "not_logged_in"
    assert status_of(BrokerSession(account_id="a"), now) == "not_logged_in"
    assert status_of(live, now) == "active"
    assert status_of(old, now) == "expired"
