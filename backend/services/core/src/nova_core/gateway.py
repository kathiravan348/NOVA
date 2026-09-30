"""Gateway: authenticated forwarding and held agent writes (D38, D67)."""

import json
from urllib.parse import quote

import httpx2
from fastapi import APIRouter, FastAPI, Request, Response
from fastapi.responses import JSONResponse
from fastapi.routing import APIRoute
from nova_common import ApiException
from nova_contracts import ApprovalRequest as ApprovalContract
from nova_db.audit import record_audit
from nova_db.ids import new_id
from nova_db.models import ApprovalRequest, User
from pydantic import JsonValue, TypeAdapter
from sqlalchemy.orm import Session
from starlette.routing import Match
from starlette.types import Scope

from nova_core.agent_rules import classify
from nova_core.deps import AppSettings, Db, SignedIn, client_ip, user_role
from nova_core.sessions import COOKIE_NAME, resolve_session
from nova_core.settings import CoreSettings

ROUTES: dict[str, str] = {
    "broker": "broker_url",
    "data-jobs": "atlas_url",
    "market-data": "atlas_url",
    "live": "atlas_url",
    "strategies": "strategy_url",
    "backtests": "backtest_url",
}
METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"]
API_PREFIX = "/api/v1"
TIMEOUT_SECONDS = 30.0
MAX_BODY_BYTES = 64 * 1024
JSON_BODY: TypeAdapter[JsonValue] = TypeAdapter(JsonValue)
router = APIRouter()


def upstream_base(settings: CoreSettings, prefix: str) -> str:
    if prefix not in ROUTES:
        raise ApiException(404, "not_found", "Unknown service")
    base: str | None = getattr(settings, ROUTES[prefix])
    if not base:
        raise ApiException(502, "internal", f"The {prefix} service is not available yet")
    return base.rstrip("/")


async def send_upstream(
    request_app: FastAPI,
    settings: CoreSettings,
    *,
    method: str,
    path: str,
    query: str,
    body: bytes,
    content_type: str | None,
    user_id: str,
    user_name: str,
    ip: str | None,
    accept: str = "application/json",
) -> Response:
    """Replayable forwarding; path is relative to /api/v1 (as stored), query is raw."""
    prefix = path.removeprefix("/").split("/", 1)[0]
    url = upstream_base(settings, prefix) + API_PREFIX + path
    if query:
        url += "?" + query
    headers = {
        "accept": accept,
        "x-nova-user-id": user_id,
        "x-nova-user-name": quote(user_name),
        "x-nova-internal-token": settings.internal_token.get_secret_value(),
    }
    if ip:
        headers["x-forwarded-for"] = ip
    if content_type:
        headers["content-type"] = content_type
    client: httpx2.AsyncClient = request_app.state.http
    try:
        upstream = await client.request(
            method, url, headers=headers, content=body, timeout=TIMEOUT_SECONDS
        )
    except httpx2.HTTPError as exc:
        raise ApiException(502, "internal", f"The {prefix} service did not answer") from exc
    passed = {name: upstream.headers[name] for name in ("location",) if name in upstream.headers}
    return Response(
        content=upstream.content,
        status_code=upstream.status_code,
        headers=passed,
        media_type=upstream.headers.get("content-type"),
    )


async def hold(request: Request, user: User, db: Session) -> JSONResponse:
    raw = bytearray()
    async for chunk in request.stream():
        raw.extend(chunk)
        if len(raw) > MAX_BODY_BYTES:
            raise ApiException(
                400, "invalid_request", "Approval body must be JSON of at most 64 KB"
            )
    content_type = request.headers.get("content-type", "").split(";", 1)[0].strip().lower()
    if raw and content_type != "application/json":
        raise ApiException(400, "invalid_request", "Approval body must be JSON")
    try:
        # Reject JSON's non-standard NaN/Infinity rather than storing values JSONB cannot represent.
        body = (
            JSON_BODY.validate_python(json.loads(raw, parse_constant=_invalid_constant))
            if raw
            else None
        )
    except ValueError as exc:
        raise ApiException(400, "invalid_request", "Approval body must be JSON") from exc
    path = request.url.path.removeprefix(API_PREFIX)
    row = ApprovalRequest(
        id=new_id("apr"),
        agent_id=user.id,
        method=request.method,
        path=path,
        query=request.url.query,
        body=body,
        status="pending",
    )
    db.add(row)
    record_audit(
        db,
        action="approval.request",
        actor_id=user.id,
        actor_name=user.name,
        summary=f"Asked: {request.method} {path}",
        target_type="approval_request",
        target_id=row.id,
        ip=client_ip(request),
    )
    db.commit()
    db.refresh(row)
    contract = ApprovalContract.model_validate(
        {
            "id": row.id,
            "method": row.method,
            "path": row.path,
            "query": row.query,
            "body": row.body,
            "status": row.status,
            "agent_name": user.name,
            "created_at": row.created_at,
            "decided_at": None,
            "decided_by": None,
            "result_status": None,
            "result_body": None,
        }
    )
    return JSONResponse(
        contract.model_dump(mode="json"), status_code=202, headers={"x-nova-approval": row.id}
    )


def _invalid_constant(value: str) -> None:
    raise ValueError(f"Invalid JSON constant: {value}")


async def forward(request: Request, user: SignedIn, settings: AppSettings, db: Db) -> Response:
    if user_role(db, user.id) == "agent":
        rule = classify(request.method, request.url.path.removeprefix(API_PREFIX))
        if rule == "blocked":
            raise ApiException(403, "forbidden", "The agent account may not do this")
        if rule == "held":
            return await hold(request, user, db)
    return await send_upstream(
        request.app,
        settings,
        method=request.method,
        path=request.url.path.removeprefix(API_PREFIX),
        query=request.url.query,
        body=await request.body(),
        content_type=request.headers.get("content-type"),
        user_id=user.id,
        user_name=user.name,
        ip=client_ip(request),
        accept=request.headers.get("accept", "application/json"),
    )


for _prefix in ROUTES:
    router.add_api_route(f"/{_prefix}", forward, methods=METHODS, include_in_schema=False)
    router.add_api_route(
        f"/{_prefix}/{{path:path}}", forward, methods=METHODS, include_in_schema=False
    )


class UnknownRoute(APIRoute):
    """Fallback only: never shadow a Core route added after the gateway router."""

    def matches(self, scope: Scope) -> tuple[Match, Scope]:
        # FastAPI may keep included routers as wrappers; checking them revisits this route.
        if scope.get("nova_checking_fallback"):
            return Match.NONE, {}
        match, child_scope = super().matches(scope)
        if match != Match.NONE:
            scope["nova_checking_fallback"] = True
            try:
                for route in scope["app"].routes:
                    if route.matches(scope)[0] != Match.NONE:
                        return Match.NONE, {}
            finally:
                scope.pop("nova_checking_fallback")
        return match, child_scope


def unknown(request: Request, db: Db) -> Response:
    token = request.cookies.get(COOKIE_NAME)
    user = resolve_session(db, token) if token else None
    if user is not None and user_role(db, user.id) == "agent":
        raise ApiException(403, "forbidden", "The agent account may not do this")
    raise ApiException(404, "not_found", "Not Found")


router.add_api_route(
    "/{path:path}",
    unknown,
    methods=METHODS,
    include_in_schema=False,
    route_class_override=UnknownRoute,
)
