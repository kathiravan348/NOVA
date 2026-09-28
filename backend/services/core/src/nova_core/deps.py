"""Request dependencies: settings, database session, signed-in user."""

from collections.abc import Iterator
from typing import Annotated, Literal

from fastapi import Depends, Request
from nova_common import ApiException
from nova_contracts import User as UserContract
from nova_db.models import User, UserRole
from sqlalchemy import select
from sqlalchemy.orm import Session, sessionmaker

from nova_core.sessions import COOKIE_NAME, resolve_session
from nova_core.settings import CoreSettings


def get_settings(request: Request) -> CoreSettings:
    settings: CoreSettings = request.app.state.settings
    return settings


def get_db(request: Request) -> Iterator[Session]:
    """One session per request. Routes commit explicitly; anything uncommitted is rolled back."""
    factory: sessionmaker[Session] = request.app.state.session_factory
    with factory() as db:
        yield db


Db = Annotated[Session, Depends(get_db)]
AppSettings = Annotated[CoreSettings, Depends(get_settings)]


UserRoleName = Literal["super_admin", "agent"]


def user_role(db: Session, user_id: str) -> UserRoleName | None:
    roles = set(db.scalars(select(UserRole.role_id).where(UserRole.user_id == user_id)))
    if "super_admin" in roles:
        return "super_admin"
    user = db.get(User, user_id)
    if "agent" in roles and user is not None and user.disabled_at is None:
        return "agent"
    return None


def is_super_admin(db: Session, user_id: str) -> bool:
    return user_role(db, user_id) == "super_admin"


def to_contract(user: User, role: UserRoleName) -> UserContract:
    return UserContract(
        id=user.id,
        name=user.name,
        email=user.email,
        role=role,
        created_at=user.created_at,
        last_login_at=user.last_login_at,
    )


def require_user(request: Request, db: Db) -> User:
    token = request.cookies.get(COOKIE_NAME)
    user = resolve_session(db, token) if token else None
    if user is None or user_role(db, user.id) is None:
        raise ApiException(401, "unauthorized", "Sign in required")
    return user


SignedIn = Annotated[User, Depends(require_user)]


def require_admin(user: SignedIn, db: Db) -> User:
    if user_role(db, user.id) != "super_admin":
        raise ApiException(403, "forbidden", "The agent account may not do this")
    return user


AdminOnly = Annotated[User, Depends(require_admin)]


def client_ip(request: Request) -> str | None:
    return request.client.host if request.client else None
