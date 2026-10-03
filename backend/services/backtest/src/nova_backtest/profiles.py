"""Research profiles (D84): versioned settings of intraday runs; frozen versions never change.

Endpoints follow the NOVA-182 contract. Writes are audited as `settings.update` on
`settings` / `research-profile/<id>`, like the recorder settings.
"""

import hashlib
import json
from datetime import UTC, datetime

from fastapi import APIRouter
from fastapi.responses import JSONResponse
from nova_common import ApiException
from nova_common.internal import Caller, CallerDep
from nova_contracts import (
    ResearchProfile,
    ResearchProfileCreate,
    ResearchProfileVersion,
    ResearchProfileVersionCreate,
    ResearchProfileVersionUpdate,
    ResearchSettings,
)
from nova_db import new_id
from nova_db.audit import record_audit
from nova_db.models import ResearchProfile as ProfileRow
from nova_db.models import ResearchProfileVersion as VersionRow
from nova_db.web import Db
from pydantic import ValidationError
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from nova_backtest.engine import EngineError

router = APIRouter(prefix="/research-profiles")

NAME_MAX = 80


def settings_hash(settings: ResearchSettings) -> str:
    """SHA-256 hex of the canonical JSON: camelCase keys sorted, no spaces, floats as `repr`."""
    canonical = json.dumps(
        settings.model_dump(mode="json", by_alias=True), sort_keys=True, separators=(",", ":")
    )
    return hashlib.sha256(canonical.encode()).hexdigest()


def _versions(db: Session, profile_id: str) -> list[VersionRow]:
    return list(
        db.scalars(
            select(VersionRow)
            .where(VersionRow.profile_id == profile_id)
            .order_by(VersionRow.version.desc())
        )
    )


def _version_contract(row: VersionRow) -> ResearchProfileVersion:
    return ResearchProfileVersion(
        version=row.version,
        note=row.note,
        settings=ResearchSettings.model_validate(row.settings),
        frozen=row.frozen,
        hash=row.hash,
        created_at=row.created_at,
        frozen_at=row.frozen_at,
    )


def _contract(db: Session, row: ProfileRow) -> ResearchProfile:
    return ResearchProfile(
        id=row.id,
        name=row.name,
        description=row.description,
        versions=[_version_contract(v) for v in _versions(db, row.id)],
        created_at=row.created_at,
        updated_at=row.updated_at,
    )


def _profile(db: Session, profile_id: str) -> ProfileRow:
    row = db.get(ProfileRow, profile_id)
    if row is None:
        raise ApiException(404, "not_found", "Research profile not found")
    return row


def _version(db: Session, profile_id: str, version: int) -> tuple[ProfileRow, VersionRow]:
    profile = _profile(db, profile_id)
    row = db.get(VersionRow, (profile_id, version))
    if row is None:
        raise ApiException(404, "not_found", "Research profile version not found")
    return profile, row


def _audit(db: Session, caller: Caller, profile: ProfileRow, summary: str) -> None:
    profile.updated_at = datetime.now(UTC)
    record_audit(
        db,
        action="settings.update",
        actor_id=caller.id,
        actor_name=caller.name,
        summary=f"Research profile {profile.name}: {summary}",
        target_type="settings",
        target_id=f"research-profile/{profile.id}",
        ip=caller.ip,
    )


def _settings_json(settings: ResearchSettings) -> dict[str, object]:
    stored: dict[str, object] = settings.model_dump(mode="json", by_alias=True)
    return stored


@router.get("")
def list_profiles(_: CallerDep, db: Db) -> JSONResponse:
    """Every profile, most recently updated first."""
    rows = db.scalars(
        select(ProfileRow).order_by(ProfileRow.updated_at.desc(), ProfileRow.id.desc())
    )
    return JSONResponse([_contract(db, row).model_dump(mode="json") for row in rows])


@router.post("")
def create_profile(body: ResearchProfileCreate, caller: CallerDep, db: Db) -> JSONResponse:
    name = body.name.strip()
    if not name or len(name) > NAME_MAX:
        raise ApiException(400, "invalid_request", f"Name must be 1-{NAME_MAX} characters")
    profile = ProfileRow(id=new_id("rp"), name=name, description=body.description)
    db.add(profile)
    db.flush()
    db.add(VersionRow(profile_id=profile.id, version=1, settings=_settings_json(body.settings)))
    _audit(db, caller, profile, "created with draft v1")
    db.commit()
    return JSONResponse(_contract(db, profile).model_dump(mode="json"), status_code=201)


@router.get("/{profile_id}")
def get_profile(profile_id: str, _: CallerDep, db: Db) -> JSONResponse:
    return JSONResponse(_contract(db, _profile(db, profile_id)).model_dump(mode="json"))


@router.post("/{profile_id}/versions")
def add_version(
    profile_id: str, body: ResearchProfileVersionCreate, caller: CallerDep, db: Db
) -> JSONResponse:
    """A new draft after the newest version; it copies nothing from earlier versions."""
    profile = _profile(db, profile_id)
    newest = db.scalar(
        select(func.max(VersionRow.version)).where(VersionRow.profile_id == profile_id)
    )
    row = VersionRow(
        profile_id=profile_id,
        version=(newest or 0) + 1,
        note=body.note,
        settings=_settings_json(body.settings),
    )
    db.add(row)
    _audit(db, caller, profile, f"draft v{row.version} added")
    db.commit()
    db.refresh(row)
    return JSONResponse(_version_contract(row).model_dump(mode="json"), status_code=201)


@router.put("/{profile_id}/versions/{version}")
def update_version(
    profile_id: str, version: int, body: ResearchProfileVersionUpdate, caller: CallerDep, db: Db
) -> JSONResponse:
    profile, row = _version(db, profile_id, version)
    if row.frozen:
        raise ApiException(400, "invalid_request", "Frozen versions cannot change")
    row.settings = _settings_json(body.settings)
    _audit(db, caller, profile, f"draft v{version} changed")
    db.commit()
    return JSONResponse(_version_contract(row).model_dump(mode="json"))


@router.post("/{profile_id}/versions/{version}/freeze")
def freeze_version(profile_id: str, version: int, caller: CallerDep, db: Db) -> JSONResponse:
    profile, row = _version(db, profile_id, version)
    if row.frozen:
        raise ApiException(400, "invalid_request", "Version is already frozen")
    settings = ResearchSettings.model_validate(row.settings)
    row.frozen = True
    row.hash = settings_hash(settings)
    row.frozen_at = datetime.now(UTC)
    _audit(db, caller, profile, f"v{version} frozen")
    db.commit()
    return JSONResponse(_version_contract(row).model_dump(mode="json"))


def get_frozen_settings(db: Session, profile_id: str, version: int) -> ResearchSettings:
    """The settings an intraday run uses (NOVA-185); only frozen versions run."""
    row = db.get(VersionRow, (profile_id, version))
    if row is None:
        raise EngineError(f"Research profile {profile_id} v{version} does not exist")
    if not row.frozen:
        raise EngineError(f"Research profile {profile_id} v{version} is not frozen")
    try:
        return ResearchSettings.model_validate(row.settings)
    except ValidationError as exc:
        raise EngineError(f"Research profile {profile_id} v{version} is not valid") from exc
