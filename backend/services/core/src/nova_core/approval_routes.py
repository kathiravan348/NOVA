"""List and decide held agent requests; claim durably before replay (D67)."""

import json
from datetime import timedelta
from typing import Annotated

from fastapi import APIRouter, HTTPException, Query, Request
from nova_common import ApiException
from nova_contracts import PAGE_LIMIT_DEFAULT, PAGE_LIMIT_MAX, ApprovalStatus, Page
from nova_contracts import ApprovalRequest as ApprovalContract
from nova_db.audit import record_audit
from nova_db.models import ApprovalRequest, User
from nova_db.paging import newest_first
from sqlalchemy import ColumnElement, func, update
from sqlalchemy.orm import Session

from nova_core import gateway
from nova_core.deps import AdminOnly, AppSettings, Db, SignedIn, client_ip, user_role

router = APIRouter()


def expire(db: Session) -> None:
    db.execute(
        update(ApprovalRequest)
        .where(
            ApprovalRequest.status == "pending",
            ApprovalRequest.decided_at.is_(None),
            ApprovalRequest.created_at <= func.now() - timedelta(minutes=30),
        )
        .values(status="expired")
    )
    db.commit()


def to_contract(db: Session, row: ApprovalRequest) -> ApprovalContract:
    agent = db.get(User, row.agent_id)
    assert agent is not None
    return ApprovalContract.model_validate(
        {
            "id": row.id,
            "method": row.method,
            "path": row.path,
            "query": row.query,
            "body": row.body,
            "status": row.status,
            "agent_name": agent.name,
            "created_at": row.created_at,
            "decided_at": row.decided_at,
            "decided_by": row.decided_by,
            "result_status": row.result_status,
            "result_body": row.result_body,
        }
    )


@router.get("/approvals")
def list_approvals(
    user: SignedIn,
    db: Db,
    status: ApprovalStatus | None = None,
    limit: Annotated[int, Query(ge=1, le=PAGE_LIMIT_MAX)] = PAGE_LIMIT_DEFAULT,
    cursor: Annotated[str | None, Query(min_length=1)] = None,
) -> Page[ApprovalContract]:
    expire(db)
    filters: list[ColumnElement[bool]] = []
    if user_role(db, user.id) == "agent":
        filters.append(ApprovalRequest.agent_id == user.id)
    if status is not None:
        filters.append(ApprovalRequest.status == status)
    rows, next_cursor = newest_first(
        db,
        ApprovalRequest,
        ApprovalRequest.created_at,
        ApprovalRequest.id,
        limit=limit,
        cursor=cursor,
        where=filters,
    )
    return Page[ApprovalContract](
        items=[to_contract(db, row) for row in rows], next_cursor=next_cursor
    )


def decide(db: Session, approval_id: str, admin: User, *, reject: bool) -> ApprovalRequest:
    expire(db)
    changes: dict[str, object] = {"decided_at": func.now(), "decided_by": admin.id}
    if reject:
        changes["status"] = "rejected"
    claimed = db.scalar(
        update(ApprovalRequest)
        .where(
            ApprovalRequest.id == approval_id,
            ApprovalRequest.status == "pending",
            ApprovalRequest.decided_at.is_(None),
            ApprovalRequest.created_at > func.now() - timedelta(minutes=30),
        )
        .values(**changes)
        .returning(ApprovalRequest.id)
    )
    db.commit()
    if claimed is None:
        raise ApiException(400, "invalid_request", "Already decided or expired")
    row = db.get(ApprovalRequest, claimed)
    assert row is not None
    return row


def audit(
    db: Session, row: ApprovalRequest, admin: User, request: Request, action: str, summary: str
) -> None:
    record_audit(
        db,
        action=action,
        actor_id=admin.id,
        actor_name=admin.name,
        summary=summary,
        target_type="approval_request",
        target_id=row.id,
        ip=client_ip(request),
    )
    db.commit()


@router.post("/approvals/{approval_id}/approve")
async def approve(
    approval_id: str,
    request: Request,
    admin: AdminOnly,
    db: Db,
    settings: AppSettings,
) -> ApprovalContract:
    row = decide(db, approval_id, admin, reject=False)
    agent = db.get(User, row.agent_id)
    assert agent is not None
    try:
        response = await gateway.send_upstream(
            request.app,
            settings,
            method=row.method,
            path=row.path,
            query=row.query,
            body=json.dumps(row.body).encode("utf-8") if row.body is not None else b"",
            content_type="application/json" if row.body is not None else None,
            user_id=agent.id,
            user_name=agent.name,
            ip=client_ip(request),
        )
        row.result_status = response.status_code
        row.result_body = bytes(response.body).decode("utf-8", errors="replace")[:8000]
        row.status = "done" if 200 <= response.status_code < 300 else "failed"
        result = str(response.status_code)
    except ApiException as exc:
        row.status = "failed"
        row.result_body = exc.message[:8000]
        result = exc.message
    audit(
        db, row, admin, request, "approval.approve", f"Approved {row.method} {row.path} → {result}"
    )
    return to_contract(db, row)


@router.post("/approvals/{approval_id}/reject")
def reject(approval_id: str, request: Request, admin: AdminOnly, db: Db) -> ApprovalContract:
    row = decide(db, approval_id, admin, reject=True)
    audit(db, row, admin, request, "approval.reject", f"Rejected {row.method} {row.path}")
    return to_contract(db, row)


@router.api_route(
    "/approvals/{approval_id}/approve",
    methods=["GET", "PUT", "PATCH", "DELETE"],
    include_in_schema=False,
)
@router.api_route(
    "/approvals/{approval_id}/reject",
    methods=["GET", "PUT", "PATCH", "DELETE"],
    include_in_schema=False,
)
def unsupported_decision_method(_: AdminOnly) -> None:
    # Check the role even for unsupported verbs on these forbidden agent paths.
    raise HTTPException(405, "Method Not Allowed", headers={"Allow": "POST"})
