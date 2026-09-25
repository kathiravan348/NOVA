"""NOVA Core: the gateway every frontend talks to (D38)."""

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

import httpx2
from fastapi import APIRouter, FastAPI
from nova_common import install_error_handlers
from nova_db import create_db_engine, create_session_factory

from nova_core import api_docs, audit_routes, auth_routes, gateway
from nova_core.settings import CoreSettings, get_core_settings

API_PREFIX = "/api/v1"


def create_app(
    settings: CoreSettings | None = None,
    *,
    upstream_transport: httpx2.AsyncBaseTransport | None = None,
) -> FastAPI:
    """`upstream_transport` replaces the network for gateway calls in tests."""
    settings = settings or get_core_settings()
    engine = create_db_engine(settings.database_url.get_secret_value())
    http = httpx2.AsyncClient(transport=upstream_transport)

    @asynccontextmanager
    async def lifespan(_: FastAPI) -> AsyncIterator[None]:
        yield
        await http.aclose()
        engine.dispose()

    app = FastAPI(
        title="NOVA Core", docs_url=None, redoc_url=None, openapi_url=None, lifespan=lifespan
    )
    app.state.settings = settings
    app.state.session_factory = create_session_factory(engine)
    app.state.http = http
    install_error_handlers(app)

    router = APIRouter(prefix=API_PREFIX)

    @router.get("/health")
    def health() -> dict[str, str]:
        return {"status": "ok"}

    if settings.api_docs:
        router.include_router(api_docs.router)
    router.include_router(auth_routes.router)
    router.include_router(audit_routes.router)
    router.include_router(gateway.router)
    app.include_router(router)
    return app


def app_factory() -> FastAPI:
    """Entry point for uvicorn (`--factory`), so settings are read when the server starts."""
    return create_app()
