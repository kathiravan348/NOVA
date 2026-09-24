import pytest
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
