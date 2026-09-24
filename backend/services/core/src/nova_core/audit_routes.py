"""`GET /audit`: the audit log, newest first, in cursor pages (D32)."""

from typing import Annotated

from fastapi import APIRouter, Query
from fastapi.responses import JSONResponse
from nova_contracts import PAGE_LIMIT_DEFAULT, PAGE_LIMIT_MAX, Page
from nova_contracts import AuditEntry as AuditEntryContract
from nova_db.models import AuditEntry
from nova_db.paging import newest_first

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
    rows, next_cursor = newest_first(
        db, AuditEntry, AuditEntry.at, AuditEntry.id, limit=limit, cursor=cursor
    )
    page = Page[AuditEntryContract](items=[to_contract(r) for r in rows], next_cursor=next_cursor)
    return JSONResponse(page.model_dump(mode="json"))
