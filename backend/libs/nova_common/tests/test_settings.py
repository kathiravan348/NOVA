import pytest
from nova_common import openapi_url
from nova_common.settings import Settings
from pydantic import ValidationError


def test_reads_prefixed_environment(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("NOVA_DATABASE_URL", "postgresql://u:p@db:5432/nova")
    monkeypatch.setenv("NOVA_REDIS_URL", "redis://redis:6379/0")
    monkeypatch.setenv("NOVA_LOG_LEVEL", "debug")

    settings = Settings()

    assert settings.database_url.get_secret_value() == "postgresql://u:p@db:5432/nova"
    assert settings.log_level == "debug"
    assert "p@db" not in repr(settings)


def test_missing_required_values_fail(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("NOVA_DATABASE_URL", raising=False)
    monkeypatch.delenv("NOVA_REDIS_URL", raising=False)

    with pytest.raises(ValidationError):
        Settings()


def test_empty_values_count_as_unset(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("NOVA_DATABASE_URL", "postgresql://u:p@db:5432/nova")
    monkeypatch.setenv("NOVA_REDIS_URL", "redis://redis:6379/0")
    monkeypatch.setenv("NOVA_LOG_LEVEL", "")

    assert Settings().log_level == "info"


def test_api_docs_default_off(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("NOVA_DATABASE_URL", "postgresql://u:p@db:5432/nova")
    monkeypatch.setenv("NOVA_REDIS_URL", "redis://redis:6379/0")
    monkeypatch.delenv("NOVA_API_DOCS", raising=False)

    assert openapi_url(Settings()) is None

    monkeypatch.setenv("NOVA_API_DOCS", "true")

    assert openapi_url(Settings()) == "/openapi.json"
