"""Kite session rules (R4, D39): expiry 06:00 IST, status derived on read, expiry audited once."""

from datetime import UTC, datetime, time, timedelta
from zoneinfo import ZoneInfo

from nova_contracts import BrokerAccount as BrokerAccountContract
from nova_contracts import BrokerSession as BrokerSessionContract
from nova_contracts import BrokerSessionStatus
from nova_db.audit import record_audit
from nova_db.models import AuditEntry, BrokerAccount, BrokerSession
from sqlalchemy import select
from sqlalchemy.orm import Session

IST = ZoneInfo("Asia/Kolkata")
TOKEN_RESET = time(6, 0)


def expiry_after(login: datetime) -> datetime:
    """The next 06:00 IST after `login`, in UTC."""
    local = login.astimezone(IST)
    reset = datetime.combine(local.date(), TOKEN_RESET, tzinfo=IST)
    if local >= reset:
        reset += timedelta(days=1)
    return reset.astimezone(UTC)


def status_of(session: BrokerSession | None, now: datetime) -> BrokerSessionStatus:
    if session is None or session.expires_at is None:
        return "not_logged_in"
    return "expired" if session.expires_at <= now else "active"


def note_expiry(db: Session, account: BrokerAccount, session: BrokerSession) -> None:
    """Records `broker.session_expired` the first time an expired session is seen."""
    if session.expires_at is None:
        return
    seen = db.scalar(
        select(AuditEntry.id).where(
            AuditEntry.action == "broker.session_expired",
            AuditEntry.target_id == account.id,
            AuditEntry.at >= session.expires_at,
        )
    )
    if seen is None:
        record_audit(
            db,
            action="broker.session_expired",
            actor_id=None,
            actor_name="System",
            summary=f"Kite session expired for {account.label}",
            target_type="broker_account",
            target_id=account.id,
        )


def to_contract(
    account: BrokerAccount, session: BrokerSession | None, now: datetime
) -> BrokerAccountContract:
    status = status_of(session, now)
    return BrokerAccountContract(
        id=account.id,
        broker="zerodha",
        label=account.label,
        client_id=account.client_id,
        enabled=account.enabled,
        session=BrokerSessionContract(
            status=status,
            logged_in_at=session.logged_in_at if session and status != "not_logged_in" else None,
            expires_at=session.expires_at if session and status != "not_logged_in" else None,
        ),
        created_at=account.created_at,
    )
