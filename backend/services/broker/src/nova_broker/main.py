"""NOVA broker service (D35, D39). Reached only through NOVA Core; never exposed to the host."""

import time
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

import httpx2
from fastapi import APIRouter, FastAPI
from nova_common import install_error_handlers
from nova_db import create_db_engine, create_session_factory
from nova_db.models import BrokerAccount
from redis import Redis
from sqlalchemy import select

from nova_broker import accounts, internal, profiles, rate_limits
from nova_broker.kite import KiteClient
from nova_broker.limiter import RateLimiter
from nova_broker.limits import ensure_rules
from nova_broker.settings import BrokerSettings, get_broker_settings

API_PREFIX = "/api/v1"


def create_app(
    settings: BrokerSettings | None = None,
    *,
    kite_transport: httpx2.BaseTransport | None = None,
    redis: Redis | None = None,
) -> FastAPI:
    """`kite_transport` replaces the network for Kite calls in tests (D35)."""
    settings = settings or get_broker_settings()
    engine = create_db_engine(settings.database_url.get_secret_value())
    session_factory = create_session_factory(engine)
    redis = redis or Redis.from_url(settings.redis_url.get_secret_value())
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
            for account_id in db.scalars(select(BrokerAccount.id)).all():
                ensure_rules(db, account_id)
            db.commit()
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
    app.state.limiter = RateLimiter(redis, settings.kite_daily_reset)
    app.state.sleep = time.sleep
    install_error_handlers(app)

    router = APIRouter(prefix=API_PREFIX)

    @router.get("/health")
    def health() -> dict[str, str]:
        return {"status": "ok"}

    router.include_router(accounts.router)
    router.include_router(profiles.router)
    router.include_router(rate_limits.router)
    app.include_router(router)
    # Service-to-service only (D41): outside /api/v1, so NOVA Core never forwards it.
    app.include_router(internal.router)
    return app


def app_factory() -> FastAPI:
    return create_app()
