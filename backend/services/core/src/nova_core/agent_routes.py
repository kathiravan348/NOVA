"""Super-admin management of the single agent account (D67)."""

from datetime import UTC, datetime

from fastapi import APIRouter, Request
from nova_common import ApiException
from nova_contracts import AgentAccessUpdate, AgentAccount, AgentAccountCreate, AgentPasswordUpdate
from nova_db.audit import record_audit
from nova_db.models import Role, User, UserRole
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from nova_core.cli import create_user, validate_password
from nova_core.deps import AdminOnly, Db, client_ip
from nova_core.passwords import hash_password
from nova_core.sessions import revoke_user_sessions

router = APIRouter()


def find_agent(db: Session) -> User | None:
    return db.scalar(select(User).join(UserRole).where(UserRole.role_id == "agent"))


def require_agent(db: Session) -> User:
    agent = find_agent(db)
    if agent is None:
        raise ApiException(404, "not_found", "No agent account")
    return agent


def to_contract(agent: User) -> AgentAccount:
    return AgentAccount(
        id=agent.id,
        name=agent.name,
        email=agent.email,
        enabled=agent.disabled_at is None,
        created_at=agent.created_at,
        last_login_at=agent.last_login_at,
    )


def audit(
    db: Session, admin: User, agent: User, request: Request, action: str, summary: str
) -> None:
    record_audit(
        db,
        action=action,
        actor_id=admin.id,
        actor_name=admin.name,
        summary=summary,
        target_type="user",
        target_id=agent.id,
        ip=client_ip(request),
    )
    db.commit()


@router.get("/agent")
def get_agent(_: AdminOnly, db: Db) -> AgentAccount:
    return to_contract(require_agent(db))


@router.post("/agent", status_code=201)
def add_agent(body: AgentAccountCreate, request: Request, admin: AdminOnly, db: Db) -> AgentAccount:
    # Serialize creation against the seeded role row, including concurrent requests.
    db.scalar(select(Role).where(Role.id == "agent").with_for_update())
    if find_agent(db) is not None:
        raise ApiException(400, "invalid_request", "An agent account already exists")
    try:
        agent = create_user(
            db, email=body.email, name=body.name, password=body.password, role="agent"
        )
        audit(db, admin, agent, request, "agent.create", "Created agent account")
    except (ValueError, IntegrityError) as exc:
        db.rollback()
        message = str(exc) if isinstance(exc, ValueError) else "Email already used"
        raise ApiException(400, "invalid_request", message) from exc
    return to_contract(agent)


@router.put("/agent/password")
def set_password(
    body: AgentPasswordUpdate, request: Request, admin: AdminOnly, db: Db
) -> AgentAccount:
    agent = require_agent(db)
    validate_password(body.password)
    agent.password_hash = hash_password(body.password)
    revoke_user_sessions(db, agent.id)
    audit(db, admin, agent, request, "agent.password", "Changed agent password")
    return to_contract(agent)


@router.patch("/agent")
def set_access(body: AgentAccessUpdate, request: Request, admin: AdminOnly, db: Db) -> AgentAccount:
    agent = require_agent(db)
    agent.disabled_at = None if body.enabled else datetime.now(UTC)
    if not body.enabled:
        revoke_user_sessions(db, agent.id)
    audit(
        db, admin, agent, request, "agent.access", f"Agent access {'on' if body.enabled else 'off'}"
    )
    return to_contract(agent)
