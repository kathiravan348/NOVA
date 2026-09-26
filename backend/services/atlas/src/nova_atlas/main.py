"""NOVA Atlas API (D41). Reached only through NOVA Core; the worker runs as its own process."""

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import APIRouter, FastAPI
from nova_common import install_error_handlers, openapi_url
from nova_db import create_db_engine, create_session_factory

from nova_atlas import jobs, market_data, universe_api
from nova_atlas.settings import AtlasSettings, get_atlas_settings

API_PREFIX = "/api/v1"


def create_app(
    settings: AtlasSettings | None = None,
) -> FastAPI:
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
