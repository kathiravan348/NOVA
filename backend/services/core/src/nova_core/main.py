"""NOVA Core: the gateway every frontend talks to."""

from fastapi import APIRouter, FastAPI
from nova_common import install_error_handlers

API_PREFIX = "/api/v1"


def create_app() -> FastAPI:
    app = FastAPI(title="NOVA Core", docs_url=None, redoc_url=None, openapi_url=None)
    install_error_handlers(app)
    router = APIRouter(prefix=API_PREFIX)

    @router.get("/health")
    def health() -> dict[str, str]:
        return {"status": "ok"}

    app.include_router(router)
    return app


app = create_app()
