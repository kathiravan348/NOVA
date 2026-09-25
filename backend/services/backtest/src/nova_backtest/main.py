"""NOVA backtest service API (D44), reached only through NOVA Core; the worker runs separately."""

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import APIRouter, FastAPI
from nova_common import install_error_handlers, openapi_url
from nova_db import create_db_engine, create_session_factory

from nova_backtest import routes
from nova_backtest.settings import BacktestSettings, get_backtest_settings

API_PREFIX = "/api/v1"


def create_app(settings: BacktestSettings | None = None) -> FastAPI:
    settings = settings or get_backtest_settings()
    engine = create_db_engine(settings.database_url.get_secret_value())

    @asynccontextmanager
    async def lifespan(_: FastAPI) -> AsyncIterator[None]:
        yield
        engine.dispose()

    app = FastAPI(
        title="NOVA Backtest",
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

    router.include_router(routes.router)
    app.include_router(router)
    return app


def app_factory() -> FastAPI:
    return create_app()
