"""`GET` / `PUT /broker/recorder`: Relay's switch for live tick recording (D54)."""

from datetime import UTC, datetime

from fastapi import APIRouter
from fastapi.responses import JSONResponse
from nova_common import ApiException
from nova_contracts import RecorderSettings, RecorderSettingsUpdate, RecorderState
from nova_db.audit import record_audit
from nova_db.models import BrokerAccount, BrokerSession, RecorderSetting
from nova_db.web import Db
from sqlalchemy import select
from sqlalchemy.orm import Session

from nova_broker.deps import CallerDep
from nova_broker.recorder_loop import in_market_hours, load_setting, running_job, tick_symbols

router = APIRouter(prefix="/broker")


def _has_live_session(db: Session, now: datetime) -> bool:
    query = (
        select(BrokerAccount.id)
        .join(BrokerSession, BrokerSession.account_id == BrokerAccount.id)
        .where(
            BrokerAccount.enabled,
            BrokerSession.access_token_encrypted.is_not(None),
            BrokerSession.expires_at > now,
        )
        .limit(1)
    )
    return db.scalar(query) is not None


def _view(db: Session, row: RecorderSetting, now: datetime) -> dict[str, object]:
    job = running_job(db)
    state: RecorderState
    if not row.enabled:
        state = "off"
    elif job is not None:
        state = "recording"
    elif in_market_hours(now) and not _has_live_session(db, now):
        state = "no_login"
    else:
        state = "waiting"
    body = RecorderSettings.model_validate(
        {
            "enabled": row.enabled,
            "symbols": row.symbols,
            "state": state,
            "job_id": job.id if job is not None and row.enabled else None,
            "updated_at": row.updated_at,
        }
    )
    return body.model_dump(mode="json")


@router.get("/recorder")
def get_recorder(_: CallerDep, db: Db) -> JSONResponse:
    row = load_setting(db)
    db.commit()
    return JSONResponse(_view(db, row, datetime.now(UTC)))


@router.put("/recorder")
def put_recorder(body: RecorderSettingsUpdate, caller: CallerDep, db: Db) -> JSONResponse:
    symbols = sorted(set(body.symbols))
    summary = "Tick recording off"
    if body.enabled:
        try:
            chosen = tick_symbols(db, symbols)
        except ValueError as exc:
            raise ApiException(400, "invalid_request", str(exc)) from exc
        which = f"{len(symbols)} stock(s)" if symbols else f"all {len(chosen)} synced stock(s)"
        summary = f"Tick recording on: {which}"
    row = load_setting(db)
    row.enabled = body.enabled
    row.symbols = symbols
    row.updated_at = datetime.now(UTC)
    record_audit(
        db,
        action="settings.update",
        actor_id=caller.id,
        actor_name=caller.name,
        summary=summary,
        target_type="settings",
        target_id="recorder",
        ip=caller.ip,
    )
    db.commit()
    return JSONResponse(_view(db, row, datetime.now(UTC)))
