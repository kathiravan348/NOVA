"""Kite data for other NOVA services (D41), outside `/api/v1`: the gateway never forwards it.

Every call takes a rate-limiter slot first (D40) and uses the first enabled, logged-in account.
"""

import hmac
import time
from collections.abc import Callable
from datetime import UTC, datetime
from typing import Annotated

from fastapi import APIRouter, Depends, Query, Request
from fastapi.responses import JSONResponse, PlainTextResponse
from nova_common import ApiException
from nova_db.models import BrokerAccount, BrokerSession, RateLimitRule
from nova_db.web import Db
from sqlalchemy import select

from nova_broker.deps import AppSettings, Cipher, Kite
from nova_broker.kite import INTERVALS, KiteError
from nova_broker.limiter import RateLimiter

router = APIRouter(prefix="/internal/kite")

MAX_WAIT_SECONDS = 20.0
EXCHANGES = ("NSE", "NFO")


def require_service(request: Request, settings: AppSettings) -> None:
    sent = request.headers.get("x-nova-internal-token", "").encode("utf-8")
    if not hmac.compare_digest(sent, settings.internal_token.get_secret_value().encode("utf-8")):
        raise ApiException(401, "unauthorized", "Only NOVA services may call this endpoint")


Service = Annotated[None, Depends(require_service)]


def active_session(db: Db, cipher: Cipher) -> tuple[str, str]:
    """The account id and decrypted access token of the first enabled, logged-in account."""
    row = db.execute(
        select(BrokerAccount.id, BrokerSession.access_token_encrypted)
        .join(BrokerSession, BrokerSession.account_id == BrokerAccount.id)
        .where(BrokerAccount.enabled, BrokerSession.expires_at > datetime.now(UTC))
        .order_by(BrokerAccount.created_at)
        .limit(1)
    ).first()
    if row is None or row[1] is None:
        raise ApiException(
            400, "invalid_request", "Log in to Kite in Relay first: no account has a live session"
        )
    return row[0], cipher.decrypt(row[1])


def wait_for_slot(request: Request, db: Db, account_id: str, endpoint: str) -> None:
    limiter: RateLimiter = request.app.state.limiter
    sleep: Callable[[float], None] = request.app.state.sleep
    limits = {
        rule.rate_window: rule.nova_limit
        for rule in db.scalars(
            select(RateLimitRule).where(
                RateLimitRule.account_id == account_id, RateLimitRule.endpoint == endpoint
            )
        )
    }
    if not limits:
        raise ApiException(500, "internal", f"No rate-limit rules for {endpoint}")
    deadline = time.monotonic() + MAX_WAIT_SECONDS
    while True:
        decision = limiter.acquire(account_id, endpoint, limits, datetime.now(UTC))
        if decision.allowed:
            return
        wait = decision.retry_after_ms / 1000
        if time.monotonic() + wait > deadline:
            raise ApiException(503, "internal", f"Kite {endpoint} limit is busy; try again later")
        sleep(wait)


@router.get("/instruments/{exchange}")
def instruments(
    exchange: str, request: Request, _: Service, db: Db, kite: Kite, cipher: Cipher
) -> PlainTextResponse:
    if exchange not in EXCHANGES:
        raise ApiException(
            400, "invalid_request", f"Exchange must be one of {', '.join(EXCHANGES)}"
        )
    account_id, token = active_session(db, cipher)
    wait_for_slot(request, db, account_id, "other")
    try:
        return PlainTextResponse(kite.instruments(exchange, token), media_type="text/csv")
    except KiteError as exc:
        raise ApiException(502, "internal", str(exc)) from exc


@router.get("/historical")
def historical(
    request: Request,
    _: Service,
    db: Db,
    kite: Kite,
    cipher: Cipher,
    instrument_token: Annotated[int, Query(gt=0)],
    interval: str,
    start: datetime,
    end: datetime,
) -> JSONResponse:
    if interval not in INTERVALS:
        raise ApiException(
            400, "invalid_request", f"Interval must be one of {', '.join(INTERVALS)}"
        )
    if start.tzinfo is None or end.tzinfo is None or start > end:
        raise ApiException(
            400, "invalid_request", "start and end must be ordered, with a time zone"
        )
    account_id, token = active_session(db, cipher)
    wait_for_slot(request, db, account_id, "historical")
    try:
        candles = kite.historical(instrument_token, interval, start, end, token)
    except KiteError as exc:
        raise ApiException(502, "internal", str(exc)) from exc
    return JSONResponse({"candles": candles})
