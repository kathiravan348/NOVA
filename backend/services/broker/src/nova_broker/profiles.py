"""Broker profile (D28): facts from `data/zerodha.json`, saved to `broker_profiles` at start-up.

App details (keys, plan, static IP) are per account since D55: see `kite_app`.
"""

import json
from importlib import resources
from typing import Any

from fastapi import APIRouter
from fastapi.responses import JSONResponse
from nova_common import ApiException
from nova_contracts import BrokerProfile as BrokerProfileContract
from nova_db.models import BrokerProfile
from nova_db.web import Db
from sqlalchemy import select
from sqlalchemy.orm import Session

from nova_broker.deps import CallerDep

router = APIRouter(prefix="/broker")


def _profile_data() -> dict[str, Any]:
    """Any: the data file is JSON validated by `BrokerProfileContract` before it is saved."""
    text = resources.files("nova_broker").joinpath("data/zerodha.json").read_text("utf-8")
    data: dict[str, Any] = json.loads(text)
    return data


def sync_profile(db: Session) -> None:
    """Writes the Zerodha profile (called at start-up)."""
    data = _profile_data()
    contract = BrokerProfileContract.model_validate(
        {
            "broker": data["broker"],
            "name": data["name"],
            "api": data["api"],
            "session_rule": data["sessionRule"],
            "links": data["links"],
        },
        strict=False,
    )
    row = db.get(BrokerProfile, contract.broker) or BrokerProfile(broker=contract.broker)
    row.name = contract.name
    row.api = contract.api
    row.session_rule = contract.session_rule
    row.links = [link.model_dump(mode="json") for link in contract.links]
    db.add(row)
    db.commit()


def to_contract(row: BrokerProfile) -> BrokerProfileContract:
    return BrokerProfileContract.model_validate(
        {
            "broker": row.broker,
            "name": row.name,
            "api": row.api,
            "session_rule": row.session_rule,
            "links": row.links,
        },
        strict=False,
    )


@router.get("/profiles")
def list_profiles(_: CallerDep, db: Db) -> JSONResponse:
    rows = db.scalars(select(BrokerProfile).order_by(BrokerProfile.broker)).all()
    return JSONResponse([to_contract(row).model_dump(mode="json") for row in rows])


@router.get("/profiles/{broker}")
def get_profile(broker: str, _: CallerDep, db: Db) -> JSONResponse:
    row = db.get(BrokerProfile, broker)
    if row is None:
        raise ApiException(404, "not_found", f"Broker profile {broker} not found")
    return JSONResponse(to_contract(row).model_dump(mode="json"))
