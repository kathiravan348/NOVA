"""Broker profile (D28): facts from `data/zerodha.json` plus settings, saved to `broker_profiles`.

Only the last 4 characters of the API key are ever stored or sent; the secret never is.
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
from nova_broker.settings import BrokerSettings

router = APIRouter(prefix="/broker")


def _profile_data() -> dict[str, Any]:
    """Any: the data file is JSON validated by `BrokerProfileContract` before it is saved."""
    text = resources.files("nova_broker").joinpath("data/zerodha.json").read_text("utf-8")
    data: dict[str, Any] = json.loads(text)
    return data


def sync_profile(db: Session, settings: BrokerSettings) -> None:
    """Writes the Zerodha profile when an API key is configured (called at start-up)."""
    if settings.kite_api_key is None:
        return
    data = _profile_data()
    contract = BrokerProfileContract.model_validate(
        {
            "broker": data["broker"],
            "name": data["name"],
            "api": data["api"],
            "plan": settings.kite_plan,
            "subscription_renews_on": settings.kite_renews_on,
            "api_key_last4": settings.kite_api_key.get_secret_value()[-4:],
            "redirect_url": settings.kite_redirect_url,
            "postback_url": settings.kite_postback_url,
            "static_ip": settings.kite_static_ip,
            "session_rule": data["sessionRule"],
            "links": data["links"],
        },
        strict=False,
    )
    row = db.get(BrokerProfile, contract.broker) or BrokerProfile(broker=contract.broker)
    row.name = contract.name
    row.api = contract.api
    row.plan = contract.plan
    row.subscription_renews_on = contract.subscription_renews_on
    row.api_key_last4 = contract.api_key_last4
    row.redirect_url = contract.redirect_url
    row.postback_url = contract.postback_url
    row.static_ip = contract.static_ip
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
            "plan": row.plan,
            "subscription_renews_on": row.subscription_renews_on,
            "api_key_last4": row.api_key_last4,
            "redirect_url": row.redirect_url,
            "postback_url": row.postback_url,
            "static_ip": row.static_ip,
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
