from typing import Any

import pytest
from fastapi.testclient import TestClient
from nova_backtest.engine import EngineError
from nova_backtest.profiles import get_frozen_settings, settings_hash
from nova_contracts import ResearchSettings, default_research_settings
from nova_db.models import AuditEntry
from nova_testing.parity import Parity
from sqlalchemy import Engine, select, text
from sqlalchemy.orm import Session

PROFILES = "/api/v1/research-profiles"
DEFAULT_HASH = "b206dcab136a0168bc9130ffe3a51e811d7f0d8415034c14f0141265b86e2cf0"


@pytest.fixture
def profiles(clean: Engine) -> Engine:
    with clean.begin() as connection:
        connection.execute(text("TRUNCATE research_profiles CASCADE"))
    return clean


def _settings(**changes: Any) -> dict[str, Any]:
    # Any: settings are arbitrary JSON groups sent as request bodies.
    settings: dict[str, Any] = default_research_settings().model_dump(mode="json")
    for path, value in changes.items():
        group, field = path.split("__")
        settings[group][field] = value
    return settings


def _create(client: TestClient, name: str = "Intraday v1") -> dict[str, Any]:
    response = client.post(
        PROFILES, json={"name": name, "description": "First plan", "settings": _settings()}
    )
    assert response.status_code == 201, response.text
    created: dict[str, Any] = response.json()
    return created


def _audits(engine: Engine) -> list[tuple[str, str, str | None, str | None]]:
    with Session(engine) as db:
        rows = db.scalars(select(AuditEntry).order_by(AuditEntry.at, AuditEntry.id))
        return [(r.action, r.summary, r.target_type, r.target_id) for r in rows]


def test_create_version_update_freeze_and_list(
    client: TestClient, profiles: Engine, parity: Parity
) -> None:
    profile = _create(client)
    parity.assert_valid(profile, "ResearchProfile")
    assert [(v["version"], v["frozen"], v["hash"]) for v in profile["versions"]] == [
        (1, False, None)
    ]
    assert profile["versions"][0]["settings"] == _settings()
    pid = profile["id"]

    changed = _settings(execution__maxSpreadBps=6)
    updated = client.put(f"{PROFILES}/{pid}/versions/1", json={"settings": changed})
    assert updated.status_code == 200 and updated.json()["settings"] == changed
    frozen = client.post(f"{PROFILES}/{pid}/versions/1/freeze")
    assert frozen.status_code == 200
    parity.assert_valid(frozen.json(), "ResearchProfileVersion")
    assert frozen.json()["frozen"] is True and frozen.json()["frozenAt"] is not None
    assert frozen.json()["hash"] == settings_hash(ResearchSettings.model_validate(changed))

    added = client.post(
        f"{PROFILES}/{pid}/versions", json={"note": "wider", "settings": _settings()}
    )
    assert added.status_code == 201
    assert (added.json()["version"], added.json()["note"], added.json()["frozen"]) == (
        2,
        "wider",
        False,
    )
    detail = client.get(f"{PROFILES}/{pid}").json()
    assert [v["version"] for v in detail["versions"]] == [2, 1]
    parity.assert_valid(detail, "ResearchProfile")

    other = _create(client, "Second")
    assert [p["id"] for p in client.get(PROFILES).json()] == [other["id"], pid]
    client.post(f"{PROFILES}/{pid}/versions/2/freeze")
    assert [p["id"] for p in client.get(PROFILES).json()] == [pid, other["id"]]

    target = f"research-profile/{pid}"
    mine = [a for a in _audits(profiles) if a[3] == target]
    assert {(a[0], a[2]) for a in mine} == {("settings.update", "settings")}
    assert [a[1].removeprefix("Research profile Intraday v1: ") for a in mine] == [
        "created with draft v1",
        "draft v1 changed",
        "v1 frozen",
        "draft v2 added",
        "v2 frozen",
    ]


def test_frozen_versions_never_change(client: TestClient, profiles: Engine) -> None:
    pid = _create(client)["id"]
    client.post(f"{PROFILES}/{pid}/versions/1/freeze")
    before = client.get(f"{PROFILES}/{pid}").json()

    edit = client.put(f"{PROFILES}/{pid}/versions/1", json={"settings": _settings()})
    again = client.post(f"{PROFILES}/{pid}/versions/1/freeze")

    assert (edit.status_code, edit.json()["error"]["message"]) == (
        400,
        "Frozen versions cannot change",
    )
    assert (again.status_code, again.json()["error"]["message"]) == (
        400,
        "Version is already frozen",
    )
    assert client.get(f"{PROFILES}/{pid}").json() == before


@pytest.mark.parametrize(
    ("method", "path", "message"),
    [
        ("GET", "/rp_nope", "Research profile not found"),
        ("POST", "/rp_nope/versions", "Research profile not found"),
        ("PUT", "/rp_nope/versions/1", "Research profile not found"),
        ("POST", "/rp_nope/versions/1/freeze", "Research profile not found"),
        ("PUT", "/{pid}/versions/9", "Research profile version not found"),
        ("POST", "/{pid}/versions/9/freeze", "Research profile version not found"),
    ],
)
def test_unknown_profiles_and_versions(
    client: TestClient, profiles: Engine, method: str, path: str, message: str
) -> None:
    pid = _create(client)["id"]
    body = {"note": "", "settings": _settings()} if method == "POST" else {"settings": _settings()}
    response = client.request(
        method, PROFILES + path.format(pid=pid), json=None if "freeze" in path else body
    )
    assert (response.status_code, response.json()["error"]["message"]) == (404, message)


@pytest.mark.parametrize(
    "body",
    [
        {"name": "", "description": "", "settings": _settings()},
        {"name": "x" * 81, "description": "", "settings": _settings()},
        {"name": "Bad pools", "description": "", "settings": _settings(account__reservePercent=61)},
        {"name": "Extra", "description": "", "settings": _settings(), "extra": 1},
    ],
)
def test_invalid_bodies_are_refused(
    client: TestClient, profiles: Engine, body: dict[str, Any]
) -> None:
    response = client.post(PROFILES, json=body)
    assert response.status_code == 400
    assert client.get(PROFILES).json() == []


def test_hash_is_canonical() -> None:
    settings = default_research_settings()
    assert settings_hash(settings) == DEFAULT_HASH
    dumped = settings.model_dump(mode="json")
    reordered = {
        group: dict(reversed(fields.items())) for group, fields in reversed(dumped.items())
    }
    assert settings_hash(ResearchSettings.model_validate(reordered)) == DEFAULT_HASH
    as_ints = _settings(account__initialPoolPercent=30)
    assert settings_hash(ResearchSettings.model_validate(as_ints)) == DEFAULT_HASH
    for change in (
        {"execution__maxSpreadBps": 8.5},
        {"timing__squareOff": "15:19"},
        {"market__marketGate": False},
    ):
        assert settings_hash(ResearchSettings.model_validate(_settings(**change))) != DEFAULT_HASH


def test_get_frozen_settings(client: TestClient, profiles: Engine) -> None:
    pid = _create(client)["id"]
    with Session(profiles) as db, pytest.raises(EngineError, match="is not frozen"):
        get_frozen_settings(db, pid, 1)
    client.post(f"{PROFILES}/{pid}/versions/1/freeze")
    with Session(profiles) as db:
        assert get_frozen_settings(db, pid, 1) == default_research_settings()
        with pytest.raises(EngineError, match="does not exist"):
            get_frozen_settings(db, pid, 2)
