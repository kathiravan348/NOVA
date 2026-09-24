"""`GET /audit`: the audit log, newest first, in cursor pages (D32)."""

from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Query
from fastapi.responses import JSONResponse
from nova_common.paging import decode_cursor, encode_cursor
from nova_contracts import PAGE_LIMIT_DEFAULT, PAGE_LIMIT_MAX, Page
from nova_contracts import AuditEntry as AuditEntryContract
from nova_db.models import AuditEntry
from sqlalchemy import select, tuple_

from nova_core.deps import Db, SignedIn

router = APIRouter()


def to_contract(row: AuditEntry) -> AuditEntryContract:
    return AuditEntryContract.model_validate(
        {
            "id": row.id,
            "at": row.at,
            "actor_id": row.actor_id,
            "actor_name": row.actor_name,
            "action": row.action,
            "target_type": row.target_type,
            "target_id": row.target_id,
            "summary": row.summary,
            "ip": row.ip,
        }
    )


@router.get("/audit")
def list_audit(
    _: SignedIn,
    db: Db,
    limit: Annotated[int, Query(ge=1, le=PAGE_LIMIT_MAX)] = PAGE_LIMIT_DEFAULT,
    cursor: Annotated[str | None, Query(min_length=1)] = None,
) -> JSONResponse:
    query = select(AuditEntry).order_by(AuditEntry.at.desc(), AuditEntry.id.desc())
    if cursor is not None:
        at, entry_id = decode_cursor(cursor, 2)
        query = query.where(
            tuple_(AuditEntry.at, AuditEntry.id) < (datetime.fromisoformat(at), entry_id)
        )
    rows = list(db.scalars(query.limit(limit + 1)))
    more, rows = len(rows) > limit, rows[:limit]
    next_cursor = encode_cursor([rows[-1].at.isoformat(), rows[-1].id]) if more else None
    page = Page[AuditEntryContract](items=[to_contract(r) for r in rows], next_cursor=next_cursor)
    return JSONResponse(page.model_dump(mode="json"))
