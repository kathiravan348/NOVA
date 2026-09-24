"""Browser sessions (D38): the cookie holds a random token, the database only its SHA-256."""

import hashlib
import secrets
from datetime import UTC, datetime, timedelta

from nova_db.models import AuthSession, User
from sqlalchemy.orm import Session

COOKIE_NAME = "nova_session"


def token_hash(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def create_session(
    db: Session, user_id: str, *, hours: int, ip: str | None, user_agent: str | None
) -> str:
    token = secrets.token_urlsafe(32)
    db.add(
        AuthSession(
            id=token_hash(token),
            user_id=user_id,
            expires_at=datetime.now(UTC) + timedelta(hours=hours),
            ip=ip,
            user_agent=user_agent,
        )
    )
    return token


def resolve_session(db: Session, token: str) -> User | None:
    """The signed-in user, or None for an unknown or expired token (expired rows are removed)."""
    row = db.get(AuthSession, token_hash(token))
    if row is None:
        return None
    if row.expires_at <= datetime.now(UTC):
        db.delete(row)
        db.commit()
        return None
    return db.get(User, row.user_id)


def revoke_session(db: Session, token: str) -> None:
    row = db.get(AuthSession, token_hash(token))
    if row is not None:
        db.delete(row)
