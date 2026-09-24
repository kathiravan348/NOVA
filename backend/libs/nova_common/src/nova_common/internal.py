"""Calls from NOVA Core to a service (D38): checked internal token, signed-in user in headers."""

import hmac
from dataclasses import dataclass
from typing import Annotated
from urllib.parse import unquote

from fastapi import Depends, Request
from pydantic import SecretStr

from nova_common.errors import ApiException


@dataclass(frozen=True)
class Caller:
    """The signed-in user NOVA Core forwarded the request for."""

    id: str
    name: str
    ip: str | None


def internal_caller(request: Request, token: SecretStr) -> Caller:
    sent = request.headers.get("x-nova-internal-token", "").encode("utf-8")
    if not hmac.compare_digest(sent, token.get_secret_value().encode("utf-8")):
        raise ApiException(401, "unauthorized", "Only NOVA Core may call this service")
    user_id = request.headers.get("x-nova-user-id", "")
    name = unquote(request.headers.get("x-nova-user-name", ""))
    if not user_id or not name:
        raise ApiException(401, "unauthorized", "Signed-in user missing")
    forwarded = request.headers.get("x-forwarded-for")
    return Caller(id=user_id, name=name, ip=forwarded.split(",")[0].strip() if forwarded else None)


def app_caller(request: Request) -> Caller:
    """Dependency for services that keep their settings (with `internal_token`) on `app.state`."""
    token: SecretStr = request.app.state.settings.internal_token
    return internal_caller(request, token)


CallerDep = Annotated[Caller, Depends(app_caller)]
