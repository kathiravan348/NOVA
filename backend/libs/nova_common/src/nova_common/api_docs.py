"""API docs switch (D50): each service serves `/openapi.json` only when `NOVA_API_DOCS` is on."""

from nova_common.settings import Settings

OPENAPI_PATH = "/openapi.json"


def openapi_url(settings: Settings) -> str | None:
    """`openapi_url` for `FastAPI(...)`: the schema path when docs are on, else None (no route)."""
    return OPENAPI_PATH if settings.api_docs else None
