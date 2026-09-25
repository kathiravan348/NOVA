"""NOVA Atlas API (D41). Reached only through NOVA Core; the worker runs as its own process."""

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import APIRouter, FastAPI
from nova_common import install_error_handlers, openapi_url
from nova_db import create_db_engine, create_session_factory

from nova_atlas import jobs, market_data, universe_api
from nova_atlas.broker_client import BrokerData
from nova_atlas.settings import AtlasSettings, get_atlas_settings
from nova_atlas.universe_api import BrokerFactory

API_PREFIX = "/api/v1"


def create_app(
    settings: AtlasSettings | None = None, broker_factory: BrokerFactory | None = None
) -> FastAPI:
    """`broker_factory` makes a client for the broker's internal Kite endpoints (tests: a fake)."""
    settings = settings or get_atlas_settings()
    engine = create_db_engine(settings.database_url.get_secret_value())

    @asynccontextmanager
    async def lifespan(_: FastAPI) -> AsyncIterator[None]:
        yield
        engine.dispose()

    app = FastAPI(
        title="NOVA Atlas",
        docs_url=None,
        redoc_url=None,
        openapi_url=openapi_url(settings),
        lifespan=lifespan,
    )
    app.state.settings = settings
    app.state.session_factory = create_session_factory(engine)
    token = settings.internal_token.get_secret_value()
    app.state.broker_factory = broker_factory or (lambda: BrokerData(settings.broker_url, token))
    install_error_handlers(app)

    router = APIRouter(prefix=API_PREFIX)

    @router.get("/health")
    def health() -> dict[str, str]:
        return {"status": "ok"}

    router.include_router(jobs.router)
    router.include_router(market_data.router)
    router.include_router(universe_api.router)
    app.include_router(router)
    return app


def app_factory() -> FastAPI:
    return create_app()
