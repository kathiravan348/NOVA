"""API docs (D50): one OpenAPI schema for Core and the services it forwards to, and Swagger UI."""

import logging
from typing import Any

import httpx2
from fastapi import APIRouter, Request
from fastapi.openapi.docs import get_swagger_ui_html
from fastapi.responses import HTMLResponse
from nova_common.api_docs import OPENAPI_PATH

from nova_core.gateway import ROUTES
from nova_core.settings import CoreSettings

TIMEOUT_SECONDS = 5.0
SCHEMA_URL = "/api/v1/openapi.json"

log = logging.getLogger(__name__)
router = APIRouter()

# An OpenAPI document is free-form JSON; its shape is not ours to type.
Schema = dict[str, Any]

# Swagger groups operations by tag, in this order. Key: first path segment after /api/v1/.
TAGS: list[tuple[str, tuple[str, ...], str]] = [
    ("Auth", ("auth", "me"), "Sign-in, sign-out and the signed-in user."),
    ("Broker", ("broker",), "Zerodha accounts, Kite login, profiles and API rate limits."),
    ("Market data", ("market-data",), "Instruments and candles (Atlas)."),
    ("Data jobs", ("data-jobs",), "Instrument sync and historical downloads (Atlas)."),
    ("Strategies", ("strategies",), "Strategies, versions and stats."),
    ("Backtests", ("backtests",), "Backtest runs, results and trades."),
    ("Audit", ("audit",), "Audit log of changes."),
    ("System", ("health",), "Service health."),
]
OTHER_TAG = "Other"
METHODS = {"get", "put", "post", "delete", "options", "head", "patch", "trace"}


def upstreams(settings: CoreSettings) -> dict[str, list[str]]:
    """Base URL of each configured service → the gateway prefixes it owns."""
    owned: dict[str, list[str]] = {}
    for prefix, field in ROUTES.items():
        base: str | None = getattr(settings, field)
        if base:
            owned.setdefault(base.rstrip("/"), []).append(prefix)
    return owned


def first_segment(path: str) -> str:
    return path.removeprefix("/api/v1/").split("/", 1)[0]


def forwarded(path: str, prefixes: list[str]) -> bool:
    return first_segment(path) in prefixes


def tag_for(path: str) -> str:
    segment = first_segment(path)
    return next((name for name, owned, _ in TAGS if segment in owned), OTHER_TAG)


def tag_operations(schema: Schema) -> None:
    """Give every operation its area's tag (copies: FastAPI caches Core's schema dicts)."""
    used: set[str] = set()
    paths: Schema = {}
    for path, item in schema["paths"].items():
        tag = tag_for(path)
        used.add(tag)
        paths[path] = {
            key: {**operation, "tags": [tag]} if key in METHODS else operation
            for key, operation in item.items()
        }
    schema["paths"] = paths
    tags = [{"name": name, "description": text} for name, _, text in TAGS if name in used]
    if OTHER_TAG in used:
        tags.append({"name": OTHER_TAG, "description": "Not yet grouped."})
    schema["tags"] = tags


def merge(target: Schema, upstream: Schema, prefixes: list[str]) -> None:
    """Add the upstream's forwarded paths and its schemas; Core's definition wins a clash."""
    paths: Schema = target.setdefault("paths", {})
    for path, item in upstream.get("paths", {}).items():
        if forwarded(path, prefixes):
            paths[path] = item
    schemas: Schema = target.setdefault("components", {}).setdefault("schemas", {})
    for name, definition in upstream.get("components", {}).get("schemas", {}).items():
        if name not in schemas:
            schemas[name] = definition
        elif schemas[name] != definition:
            log.warning("OpenAPI schema %s differs between services; keeping the first", name)


async def fetch(http: httpx2.AsyncClient, base: str) -> Schema | None:
    try:
        response = await http.get(base + OPENAPI_PATH, timeout=TIMEOUT_SECONDS)
        response.raise_for_status()
        schema: Schema = response.json()
    except (httpx2.HTTPError, ValueError) as error:
        log.warning("OpenAPI schema from %s unavailable: %s", base, error)
        return None
    return schema


@router.get("/openapi.json", include_in_schema=False)
async def openapi(request: Request) -> Schema:
    settings: CoreSettings = request.app.state.settings
    schema: Schema = dict(request.app.openapi())
    schema["paths"] = dict(schema.get("paths", {}))
    components: Schema = dict(schema.get("components", {}))
    components["schemas"] = dict(components.get("schemas", {}))
    schema["components"] = components
    missing: list[str] = []
    for base, prefixes in upstreams(settings).items():
        upstream = await fetch(request.app.state.http, base)
        if upstream is None:
            missing.extend(prefixes)
        else:
            merge(schema, upstream, prefixes)
    tag_operations(schema)
    if missing:
        info: Schema = dict(schema.get("info", {}))
        info["description"] = "Not available right now: " + ", ".join(missing) + "."
        schema["info"] = info
    return schema


@router.get("/docs", include_in_schema=False)
def docs() -> HTMLResponse:
    return get_swagger_ui_html(openapi_url=SCHEMA_URL, title="NOVA API")
