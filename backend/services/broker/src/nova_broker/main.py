"""NOVA broker service (D35, D39). Reached only through NOVA Core; never exposed to the host."""

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

import httpx2
from fastapi import APIRouter, FastAPI
from nova_common import install_error_handlers
from nova_db import create_db_engine, create_session_factory

from nova_broker import accounts, profiles
from nova_broker.kite import KiteClient
from nova_broker.settings import BrokerSettings, get_broker_settings

API_PREFIX = "/api/v1"


def create_app(
    settings: BrokerSettings | None = None,
    *,
    kite_transport: httpx2.BaseTransport | None = None,
) -> FastAPI:
    """`kite_transport` replaces the network for Kite calls in tests (D35)."""
    settings = settings or get_broker_settings()
    engine = create_db_engine(settings.database_url.get_secret_value())
    session_factory = create_session_factory(engine)
    kite = (
        KiteClient(
            settings.kite_api_key.get_secret_value(),
            settings.kite_api_secret.get_secret_value(),
            transport=kite_transport,
        )
        if settings.kite_api_key and settings.kite_api_secret
        else None
    )

    @asynccontextmanager
    async def lifespan(_: FastAPI) -> AsyncIterator[None]:
        with session_factory() as db:
            profiles.sync_profile(db, settings)
        yield
        if kite is not None:
            kite.close()
        engine.dispose()

    app = FastAPI(
        title="NOVA Broker", docs_url=None, redoc_url=None, openapi_url=None, lifespan=lifespan
    )
    app.state.settings = settings
    app.state.session_factory = session_factory
    app.state.kite = kite
    install_error_handlers(app)

    router = APIRouter(prefix=API_PREFIX)

    @router.get("/health")
    def health() -> dict[str, str]:
        return {"status": "ok"}

    router.include_router(accounts.router)
    router.include_router(profiles.router)
    app.include_router(router)
    return app


def app_factory() -> FastAPI:
    return create_app()
