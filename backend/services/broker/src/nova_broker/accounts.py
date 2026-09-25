"""Broker accounts and the daily Kite login (D39)."""

import re
from datetime import UTC, datetime

from fastapi import APIRouter
from fastapi.responses import JSONResponse, RedirectResponse
from nova_common import ApiException
from nova_contracts import BrokerAccountCreate
from nova_db import new_id
from nova_db.audit import record_audit
from nova_db.models import BrokerAccount, BrokerSession
from nova_db.web import Db
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from nova_broker import login_state
from nova_broker.deps import AppSettings, CallerDep, Cipher, Kite, state_key
from nova_broker.kite import KiteError
from nova_broker.limits import ensure_rules
from nova_broker.sessions import expiry_after, note_expiry, status_of, to_contract

router = APIRouter(prefix="/broker")

CLIENT_ID = re.compile(r"^[A-Za-z0-9]{4,12}$")


def add_account(db: Session, *, label: str, client_id: str) -> BrokerAccount:
    """Adds a Zerodha account and its default rate-limit rules (CLI and `POST /broker/accounts`)."""
    if not label.strip():
        raise ValueError("Label must not be empty")
    if not CLIENT_ID.fullmatch(client_id):
        raise ValueError("Client id must be 4-12 letters or digits (your Zerodha user id)")
    exists = db.scalar(
        select(BrokerAccount.id).where(func.upper(BrokerAccount.client_id) == client_id.upper())
    )
    if exists:
        raise ValueError(f"Account {client_id.upper()} already exists")
    account = BrokerAccount(
        id=new_id("brk"), broker="zerodha", label=label.strip(), client_id=client_id.upper()
    )
    db.add(account)
    db.flush()
    ensure_rules(db, account.id)
    return account


def _account(db: Db, account_id: str) -> BrokerAccount:
    account = db.get(BrokerAccount, account_id)
    if account is None:
        raise ApiException(404, "not_found", f"Broker account {account_id} not found")
    return account


def _view(db: Db, account: BrokerAccount, now: datetime) -> dict[str, object]:
    session = db.get(BrokerSession, account.id)
    if session is not None and status_of(session, now) == "expired":
        note_expiry(db, account, session)
    return to_contract(account, session, now).model_dump(mode="json")


@router.get("/accounts")
def list_accounts(_: CallerDep, db: Db) -> JSONResponse:
    now = datetime.now(UTC)
    accounts = db.scalars(select(BrokerAccount).order_by(BrokerAccount.created_at)).all()
    body = [_view(db, account, now) for account in accounts]
    db.commit()
    return JSONResponse(body)


@router.post("/accounts", status_code=201)
def create_account(body: BrokerAccountCreate, caller: CallerDep, db: Db) -> JSONResponse:
    try:
        account = add_account(db, label=body.label, client_id=body.client_id)
    except ValueError as exc:
        raise ApiException(400, "invalid_request", str(exc)) from exc
    record_audit(
        db,
        action="broker.account_create",
        actor_id=caller.id,
        actor_name=caller.name,
        summary=f"Added {account.label} ({account.client_id})",
        target_type="broker_account",
        target_id=account.id,
        ip=caller.ip,
    )
    view = _view(db, account, datetime.now(UTC))
    db.commit()
    return JSONResponse(view, status_code=201)


@router.get("/accounts/{account_id}")
def get_account(account_id: str, _: CallerDep, db: Db) -> JSONResponse:
    body = _view(db, _account(db, account_id), datetime.now(UTC))
    db.commit()
    return JSONResponse(body)


@router.get("/accounts/{account_id}/login")
def start_login(
    account_id: str, _: CallerDep, db: Db, kite: Kite, cipher: Cipher, settings: AppSettings
) -> RedirectResponse:
    """Sends the browser to Kite. Needs `cipher` so a login never ends with nowhere to save."""
    account = _account(db, account_id)
    if not account.enabled:
        raise ApiException(400, "invalid_request", f"Broker account {account_id} is disabled")
    state = login_state.sign(state_key(settings), account.id)
    return RedirectResponse(kite.login_url(state), status_code=302)


@router.get("/kite/callback")
def kite_callback(
    caller: CallerDep,
    db: Db,
    kite: Kite,
    cipher: Cipher,
    settings: AppSettings,
    state: str = "",
    status: str = "",
    request_token: str = "",
) -> RedirectResponse:
    relay = settings.relay_url.rstrip("/")
    account_id = login_state.verify(state_key(settings), state)
    account = db.get(BrokerAccount, account_id) if account_id else None
    if account is None:
        return RedirectResponse(f"{relay}/accounts?kite=failed", status_code=302)

    def fail(reason: str) -> RedirectResponse:
        record_audit(
            db,
            action="broker.login",
            actor_id=caller.id,
            actor_name=caller.name,
            summary=f"Kite login failed for {account.label}: {reason}",
            target_type="broker_account",
            target_id=account.id,
            ip=caller.ip,
        )
        db.commit()
        return RedirectResponse(f"{relay}/accounts/{account.id}?kite=failed", status_code=302)

    if status != "success" or not request_token:
        return fail("login was cancelled or refused")
    try:
        kite_session = kite.exchange(request_token)
    except KiteError as exc:
        return fail(str(exc))
    if kite_session.user_id.upper() != account.client_id.upper():
        return fail(f"signed in as {kite_session.user_id}, expected {account.client_id}")

    login_at = kite_session.login_time.astimezone(UTC)
    session = db.get(BrokerSession, account.id) or BrokerSession(account_id=account.id)
    session.access_token_encrypted = cipher.encrypt(kite_session.access_token)
    session.logged_in_at = login_at
    session.expires_at = expiry_after(login_at)
    db.add(session)
    record_audit(
        db,
        action="broker.login",
        actor_id=caller.id,
        actor_name=caller.name,
        summary=f"Kite login for {account.label}",
        target_type="broker_account",
        target_id=account.id,
        ip=caller.ip,
    )
    db.commit()
    return RedirectResponse(f"{relay}/accounts/{account.id}?kite=connected", status_code=302)
