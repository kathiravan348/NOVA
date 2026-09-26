"""Each account's Kite app (D55): API key, sealed secret and app details, set from Relay.

The secret is sealed with the Owner's passphrase (`vault`) and never leaves this service.
"""

from datetime import UTC, datetime

from fastapi import APIRouter, Response
from fastapi.responses import JSONResponse
from nova_common import ApiException
from nova_contracts import KiteApp, KiteAppUpdate, KiteKeysUpdate, KitePassphrase
from nova_db.audit import record_audit
from nova_db.models import BrokerAccount, BrokerKiteApp, BrokerSession
from nova_db.web import Db
from sqlalchemy.orm import Session

from nova_broker import vault
from nova_broker.deps import AppSettings, CallerDep
from nova_broker.settings import BrokerSettings

router = APIRouter(prefix="/broker/accounts/{account_id}/kite-app")

NO_KEYS = "Save the Kite API key and secret first"


def redirect_url(settings: BrokerSettings) -> str:
    """What the Owner registers in the Kite developer console: the callback behind Relay's /api."""
    return f"{settings.relay_url.rstrip('/')}/api/v1/broker/kite/callback"


def _account(db: Session, account_id: str) -> BrokerAccount:
    account = db.get(BrokerAccount, account_id)
    if account is None:
        raise ApiException(404, "not_found", f"Broker account {account_id} not found")
    return account


def _app(db: Session, account_id: str) -> BrokerKiteApp:
    return db.get(BrokerKiteApp, account_id) or BrokerKiteApp(account_id=account_id)


def to_contract(row: BrokerKiteApp, settings: BrokerSettings, *, saved: bool) -> KiteApp:
    return KiteApp.model_validate(
        {
            "account_id": row.account_id,
            "api_key_last4": row.api_key[-4:] if row.api_key else None,
            "secret_saved": row.api_secret_sealed is not None,
            "plan": row.plan,
            "subscription_renews_on": row.subscription_renews_on,
            "redirect_url": redirect_url(settings),
            "postback_url": row.postback_url,
            "static_ip": row.static_ip,
            "updated_at": row.updated_at if saved else None,
        },
        strict=False,
    )


def _body(db: Session, row: BrokerKiteApp, settings: BrokerSettings) -> JSONResponse:
    saved = db.get(BrokerKiteApp, row.account_id) is not None
    return JSONResponse(to_contract(row, settings, saved=saved).model_dump(mode="json"))


def open_secret(row: BrokerKiteApp | None, passphrase: str) -> str:
    """The plain API secret, for the one request that needs it (login finish, check)."""
    if row is None or row.api_key is None or row.api_secret_sealed is None:
        raise ApiException(400, "invalid_request", NO_KEYS)
    try:
        return vault.unseal(row.api_secret_sealed, passphrase, row.account_id)
    except vault.WrongPassphrase as exc:
        raise ApiException(400, "invalid_request", "Wrong passphrase") from exc


@router.get("")
def get_kite_app(account_id: str, _: CallerDep, db: Db, settings: AppSettings) -> JSONResponse:
    _account(db, account_id)
    return _body(db, _app(db, account_id), settings)


@router.put("/keys")
def save_keys(
    account_id: str, body: KiteKeysUpdate, caller: CallerDep, db: Db, settings: AppSettings
) -> JSONResponse:
    account = _account(db, account_id)
    row = _app(db, account_id)
    key_changed = row.api_key is not None and row.api_key != body.api_key
    row.api_key = body.api_key
    row.api_secret_sealed = vault.seal(body.api_secret, body.passphrase, account_id)
    row.updated_at = datetime.now(UTC)
    db.add(row)
    session = db.get(BrokerSession, account_id)
    if key_changed and session is not None:
        # Access tokens belong to the old app: this account must log in again.
        db.delete(session)
    record_audit(
        db,
        action="broker.kite_app_update",
        actor_id=caller.id,
        actor_name=caller.name,
        summary=f"Saved Kite API key …{body.api_key[-4:]} and secret for {account.label}",
        target_type="broker_account",
        target_id=account.id,
        ip=caller.ip,
    )
    db.commit()
    return _body(db, row, settings)


@router.patch("")
def update_details(
    account_id: str, body: KiteAppUpdate, caller: CallerDep, db: Db, settings: AppSettings
) -> JSONResponse:
    account = _account(db, account_id)
    row = _app(db, account_id)
    row.plan = body.plan.strip() if body.plan else None
    row.subscription_renews_on = body.subscription_renews_on
    row.postback_url = body.postback_url
    row.static_ip = body.static_ip
    row.updated_at = datetime.now(UTC)
    db.add(row)
    record_audit(
        db,
        action="broker.kite_app_update",
        actor_id=caller.id,
        actor_name=caller.name,
        summary=f"Updated Kite app details for {account.label}",
        target_type="broker_account",
        target_id=account.id,
        ip=caller.ip,
    )
    db.commit()
    return _body(db, row, settings)


@router.post("/check", status_code=204)
def check_passphrase(account_id: str, body: KitePassphrase, _: CallerDep, db: Db) -> Response:
    _account(db, account_id)
    open_secret(db.get(BrokerKiteApp, account_id), body.passphrase)
    return Response(status_code=204)
