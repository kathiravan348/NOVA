import pytest
from nova_core.cli import create_admin, main
from nova_core.passwords import verify_password
from nova_core.settings import get_core_settings
from nova_db.models import User, UserRole
from sqlalchemy import Engine, select, text
from sqlalchemy.orm import Session


@pytest.fixture
def empty(engine: Engine) -> Engine:
    with engine.begin() as connection:
        connection.execute(text("TRUNCATE users, auth_sessions, audit_entries CASCADE"))
    return engine


def test_create_admin_hashes_the_password_and_grants_super_admin(empty: Engine) -> None:
    with Session(empty) as db:
        user = create_admin(db, email="Owner@Example.com", name="Owner", password="x" * 12)
        db.commit()
        role = db.scalar(select(UserRole.role_id).where(UserRole.user_id == user.id))

    assert user.email == "owner@example.com"
    assert verify_password("x" * 12, user.password_hash)
    assert role == "super_admin"


@pytest.mark.parametrize(
    ("email", "password", "message"),
    [
        ("owner@example.com", "short", "at least 12"),
        ("not-an-email", "x" * 12, "not valid"),
        ("OWNER@example.com", "x" * 12, "already exists"),
    ],
)
def test_create_admin_rejects_bad_input(
    empty: Engine, email: str, password: str, message: str
) -> None:
    with Session(empty) as db:
        create_admin(db, email="owner@example.com", name="Owner", password="y" * 12)
        db.flush()
        with pytest.raises(ValueError, match=message):
            create_admin(db, email=email, name="Someone", password=password)


def test_main_reads_the_password_from_the_environment(
    empty: Engine, database_url: str, monkeypatch: pytest.MonkeyPatch, internal_token: str
) -> None:
    monkeypatch.setenv("NOVA_DATABASE_URL", database_url)
    monkeypatch.setenv("NOVA_REDIS_URL", "redis://unused:6379/0")
    monkeypatch.setenv("NOVA_INTERNAL_TOKEN", internal_token)
    monkeypatch.setenv("NOVA_ADMIN_PASSWORD", "a long enough password")
    get_core_settings.cache_clear()

    code = main(["create-admin", "--email", "cli@example.com", "--name", "CLI Admin"])

    get_core_settings.cache_clear()
    assert code == 0
    with Session(empty) as db:
        user = db.scalars(select(User).where(User.email == "cli@example.com")).one()
        assert verify_password("a long enough password", user.password_hash)
