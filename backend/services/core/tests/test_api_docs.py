import httpx2
import pytest
from fastapi.testclient import TestClient
from nova_core.main import create_app
from nova_core.settings import CoreSettings

STRATEGY = "http://strategy:8000"
BACKTEST = "http://backtest:8000"

STRATEGY_SCHEMA: dict[str, object] = {
    "openapi": "3.1.0",
    "info": {"title": "NOVA Strategy", "version": "0.1.0"},
    "paths": {
        "/api/v1/strategies": {"get": {"summary": "List strategies"}},
        "/api/v1/health": {"get": {"summary": "Strategy health"}},
    },
    "components": {"schemas": {"Strategy": {"type": "object"}}},
}


class Upstreams:
    """Fake services: strategy serves its schema; backtest is down when `fail` is set."""

    def __init__(self) -> None:
        self.fail = False

    def handle(self, request: httpx2.Request) -> httpx2.Response:
        base = f"{request.url.scheme}://{request.url.host}:{request.url.port}"
        if base == BACKTEST and self.fail:
            raise httpx2.ConnectError("refused", request=request)
        if request.url.path == "/openapi.json" and base == STRATEGY:
            return httpx2.Response(200, json=STRATEGY_SCHEMA)
        return httpx2.Response(200, json={"openapi": "3.1.0", "paths": {}})


def docs_client(settings: CoreSettings, upstreams: Upstreams, *, on: bool) -> TestClient:
    settings = settings.model_copy(
        update={"api_docs": on, "strategy_url": STRATEGY, "backtest_url": BACKTEST}
    )
    return TestClient(
        create_app(settings, upstream_transport=httpx2.MockTransport(upstreams.handle))
    )


@pytest.mark.parametrize("path", ["/api/v1/docs", "/api/v1/openapi.json", "/docs", "/openapi.json"])
def test_docs_off_by_default(dummy_settings: CoreSettings, path: str) -> None:
    client = docs_client(dummy_settings, Upstreams(), on=False)

    assert client.get(path).status_code == 404


def test_swagger_ui_when_on(dummy_settings: CoreSettings) -> None:
    response = docs_client(dummy_settings, Upstreams(), on=True).get("/api/v1/docs")

    assert response.status_code == 200
    assert "swagger-ui" in response.text
    assert "/api/v1/openapi.json" in response.text


def test_schema_merges_forwarded_paths(dummy_settings: CoreSettings) -> None:
    schema = docs_client(dummy_settings, Upstreams(), on=True).get("/api/v1/openapi.json").json()

    assert "/api/v1/auth/login" in schema["paths"]
    assert "/api/v1/strategies" in schema["paths"]
    assert schema["paths"]["/api/v1/health"]["get"]["summary"] != "Strategy health"
    assert "Strategy" in schema["components"]["schemas"]
    assert "/api/v1/docs" not in schema["paths"]
    assert "description" not in schema["info"]


def test_schema_names_a_failed_service(dummy_settings: CoreSettings) -> None:
    upstreams = Upstreams()
    upstreams.fail = True

    response = docs_client(dummy_settings, upstreams, on=True).get("/api/v1/openapi.json")

    assert response.status_code == 200
    schema = response.json()
    assert "/api/v1/auth/login" in schema["paths"]
    assert "/api/v1/strategies" in schema["paths"]
    assert schema["info"]["description"] == "Not available right now: backtests."
