from datetime import UTC, datetime, timedelta

from fastapi.testclient import TestClient
from nova_core.sessions import COOKIE_NAME
from nova_db.models import AuditEntry, AuthSession, User
from nova_testing.parity import Parity
from sqlalchemy import Engine, select, update
from sqlalchemy.orm import Session

LOGIN = "/api/v1/auth/login"


def _actions(engine: Engine) -> list[str]:
    with Session(engine) as db:
        return list(db.scalars(select(AuditEntry.summary).order_by(AuditEntry.at)))


def test_login_returns_the_user_and_sets_a_safe_cookie(
    client: TestClient, parity: Parity, engine: Engine, credentials: dict[str, str]
) -> None:
    body = credentials | {"email": credentials["email"].upper()}
    response = client.post(LOGIN, json=body)

    assert response.status_code == 200
    user = response.json()
    parity.assert_valid(user, "User")
    assert user["email"] == credentials["email"] and user["role"] == "super_admin"
    assert user["lastLoginAt"] is not None
    cookie = response.headers["set-cookie"].lower()
    assert cookie.startswith(f"{COOKIE_NAME}=")
    assert "httponly" in cookie and "samesite=lax" in cookie and "max-age=43200" in cookie
    with Session(engine) as db:
        stored = db.scalars(select(AuthSession.id)).one()
    assert response.cookies[COOKIE_NAME] not in stored


def test_wrong_password_and_unknown_email_get_the_same_answer(
    client: TestClient, engine: Engine, credentials: dict[str, str]
) -> None:
    wrong = client.post(LOGIN, json={"email": credentials["email"], "password": "nope"})
    unknown = client.post(LOGIN, json={"email": "who@example.com", "password": "nope"})

    for response in (wrong, unknown):
        assert response.status_code == 401
        assert response.json() == {
            "error": {"code": "unauthorized", "message": "Wrong email or password"}
        }
        assert COOKIE_NAME not in response.cookies
    assert _actions(engine) == [
        f"Failed sign-in for {credentials['email']}",
        "Failed sign-in for who@example.com",
    ]


def test_bad_login_body_is_invalid_request(client: TestClient, credentials: dict[str, str]) -> None:
    response = client.post(LOGIN, json={"email": credentials["email"]})

    assert response.status_code == 400
    assert response.json()["error"]["code"] == "invalid_request"


def test_me_needs_a_session(client: TestClient) -> None:
    response = client.get("/api/v1/me")

    assert response.status_code == 401
    assert response.json()["error"]["code"] == "unauthorized"


def test_me_returns_the_signed_in_user(signed_in: TestClient, admin: str) -> None:
    response = signed_in.get("/api/v1/me")

    assert response.status_code == 200
    assert response.json()["id"] == admin


def test_logout_ends_the_session(signed_in: TestClient, engine: Engine) -> None:
    response = signed_in.post("/api/v1/auth/logout")

    assert response.status_code == 204
    assert signed_in.get("/api/v1/me").status_code == 401
    with Session(engine) as db:
        assert db.scalars(select(AuthSession)).all() == []
    assert _actions(engine) == ["Signed in", "Signed out"]


def test_expired_session_is_rejected_and_removed(signed_in: TestClient, engine: Engine) -> None:
    with Session(engine) as db:
        db.execute(update(AuthSession).values(expires_at=datetime.now(UTC) - timedelta(seconds=1)))
        db.commit()

    assert signed_in.get("/api/v1/me").status_code == 401
    with Session(engine) as db:
        assert db.scalars(select(AuthSession)).all() == []


def test_forged_cookie_is_rejected(client: TestClient) -> None:
    client.cookies.set(COOKIE_NAME, "forged-token")

    assert client.get("/api/v1/me").status_code == 401


def test_login_updates_last_login(signed_in: TestClient, engine: Engine, admin: str) -> None:
    with Session(engine) as db:
        user = db.get(User, admin)
        assert user is not None and user.last_login_at is not None
