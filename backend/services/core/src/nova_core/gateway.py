"""Gateway (D38): forwards `/api/v1/<prefix>/…` to the owning service for a signed-in user."""

from urllib.parse import quote

import httpx2
from fastapi import APIRouter, Request, Response
from nova_common import ApiException

from nova_core.deps import AppSettings, SignedIn, client_ip
from nova_core.settings import CoreSettings

# First path segment after /api/v1 → CoreSettings field with that service's base URL.
ROUTES: dict[str, str] = {
    "broker": "broker_url",
    "data-jobs": "atlas_url",
    "market-data": "atlas_url",
    "strategies": "strategy_url",
    "backtests": "backtest_url",
}
METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"]
TIMEOUT_SECONDS = 30.0

router = APIRouter()


def upstream_base(settings: CoreSettings, prefix: str) -> str:
    base: str | None = getattr(settings, ROUTES[prefix])
    if not base:
        raise ApiException(502, "internal", f"The {prefix} service is not available yet")
    return base.rstrip("/")


async def forward(request: Request, user: SignedIn, settings: AppSettings) -> Response:
    prefix = request.url.path.removeprefix("/api/v1/").split("/", 1)[0]
    url = upstream_base(settings, prefix) + request.url.path
    headers = {
        "accept": request.headers.get("accept", "application/json"),
        "x-nova-user-id": user.id,
        # Header values are ASCII; names may not be.
        "x-nova-user-name": quote(user.name),
        "x-nova-internal-token": settings.internal_token.get_secret_value(),
    }
    ip = client_ip(request)
    if ip:
        headers["x-forwarded-for"] = ip
    if "content-type" in request.headers:
        headers["content-type"] = request.headers["content-type"]

    client: httpx2.AsyncClient = request.app.state.http
    try:
        upstream = await client.request(
            request.method,
            url,
            params=list(request.query_params.multi_items()),
            headers=headers,
            content=await request.body(),
            timeout=TIMEOUT_SECONDS,
        )
    except httpx2.HTTPError as exc:
        raise ApiException(502, "internal", f"The {prefix} service did not answer") from exc
    # Redirects (Kite login, D39) must keep their target.
    passed = {name: upstream.headers[name] for name in ("location",) if name in upstream.headers}
    return Response(
        content=upstream.content,
        status_code=upstream.status_code,
        headers=passed,
        media_type=upstream.headers.get("content-type"),
    )


for _prefix in ROUTES:
    router.add_api_route(f"/{_prefix}", forward, methods=METHODS, include_in_schema=False)
    router.add_api_route(
        f"/{_prefix}/{{path:path}}", forward, methods=METHODS, include_in_schema=False
    )
