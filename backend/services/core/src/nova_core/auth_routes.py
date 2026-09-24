"""Sign in, sign out and `/me` (D38)."""

from datetime import UTC, datetime

from fastapi import APIRouter, Request, Response
from fastapi.responses import JSONResponse
from nova_common import ApiException
from nova_contracts import LoginRequest
from nova_db.audit import record_audit
from nova_db.models import User
from sqlalchemy import func, select

from nova_core.deps import AppSettings, Db, SignedIn, client_ip, is_super_admin, to_contract
from nova_core.passwords import DUMMY_HASH, verify_password
from nova_core.sessions import COOKIE_NAME, create_session, revoke_session

router = APIRouter()

WRONG_CREDENTIALS = "Wrong email or password"


@router.post("/auth/login")
def login(body: LoginRequest, request: Request, db: Db, settings: AppSettings) -> JSONResponse:
    ip = client_ip(request)
    user = db.scalar(select(User).where(func.lower(User.email) == body.email.lower()))
    valid = verify_password(body.password, user.password_hash if user else DUMMY_HASH)
    if user is None or not valid or not is_super_admin(db, user.id):
        record_audit(
            db,
            action="auth.login",
            actor_id=None,
            actor_name=body.email,
            summary=f"Failed sign-in for {body.email}",
            ip=ip,
        )
        db.commit()
        raise ApiException(401, "unauthorized", WRONG_CREDENTIALS)

    user.last_login_at = datetime.now(UTC)
    token = create_session(
        db,
        user.id,
        hours=settings.session_hours,
        ip=ip,
        user_agent=request.headers.get("user-agent"),
    )
    record_audit(
        db,
        action="auth.login",
        actor_id=user.id,
        actor_name=user.name,
        summary="Signed in",
        target_type="user",
        target_id=user.id,
        ip=ip,
    )
    db.commit()

    response = JSONResponse(to_contract(user).model_dump(mode="json"))
    response.set_cookie(
        COOKIE_NAME,
        token,
        max_age=settings.session_hours * 3600,
        httponly=True,
        samesite="lax",
        secure=settings.cookie_secure,
        path="/",
    )
    return response


@router.post("/auth/logout", status_code=204)
def logout(request: Request, user: SignedIn, db: Db) -> Response:
    token = request.cookies.get(COOKIE_NAME)
    if token:
        revoke_session(db, token)
    record_audit(
        db,
        action="auth.logout",
        actor_id=user.id,
        actor_name=user.name,
        summary="Signed out",
        target_type="user",
        target_id=user.id,
        ip=client_ip(request),
    )
    db.commit()
    response = Response(status_code=204)
    response.delete_cookie(COOKIE_NAME, path="/")
    return response


@router.get("/me")
def me(user: SignedIn) -> JSONResponse:
    return JSONResponse(to_contract(user).model_dump(mode="json"))
