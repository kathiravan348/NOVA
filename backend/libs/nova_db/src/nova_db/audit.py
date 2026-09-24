"""Writes audit entries (`audit_entries`). Every service records its actions through this helper."""

from sqlalchemy.orm import Session

from nova_db.ids import new_id
from nova_db.models import AuditEntry


def record_audit(
    db: Session,
    *,
    action: str,
    actor_id: str | None,
    actor_name: str,
    summary: str,
    target_type: str | None = None,
    target_id: str | None = None,
    ip: str | None = None,
) -> AuditEntry:
    """Adds an entry to the session; it is saved with the caller's transaction."""
    entry = AuditEntry(
        id=new_id("aud"),
        action=action,
        actor_id=actor_id,
        actor_name=actor_name,
        summary=summary,
        target_type=target_type,
        target_id=target_id,
        ip=ip,
    )
    db.add(entry)
    return entry
