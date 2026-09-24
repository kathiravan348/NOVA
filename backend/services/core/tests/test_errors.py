from typing import Any

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from nova_common import ApiException
from nova_contracts import ApiError
from nova_core.main import API_PREFIX, create_app


def _app_with_test_routes() -> FastAPI:
    app = create_app()

    @app.get(f"{API_PREFIX}/_test/raise")
    def raise_api_exception() -> None:
        raise ApiException(409, "invalid_request", "Already exists")

    @app.get(f"{API_PREFIX}/_test/boom")
    def boom() -> None:
        raise RuntimeError("secret detail")

    @app.get(f"{API_PREFIX}/_test/query")
    def needs_int(limit: int) -> dict[str, int]:
        return {"limit": limit}

    return app


@pytest.fixture
def client() -> TestClient:
    return TestClient(_app_with_test_routes(), raise_server_exceptions=False)


def _assert_api_error(body: Any, code: str) -> None:
    parsed = ApiError.model_validate(body)
    assert parsed.error.code == code


def test_unknown_route_is_not_found(client: TestClient) -> None:
    response = client.get("/api/v1/nope")

    assert response.status_code == 404
    _assert_api_error(response.json(), "not_found")


def test_bad_query_is_invalid_request(client: TestClient) -> None:
    response = client.get("/api/v1/_test/query", params={"limit": "abc"})

    assert response.status_code == 400
    _assert_api_error(response.json(), "invalid_request")
    assert "limit" in response.json()["error"]["message"]


def test_api_exception_keeps_status_and_message(client: TestClient) -> None:
    response = client.get("/api/v1/_test/raise")

    assert response.status_code == 409
    assert response.json() == {"error": {"code": "invalid_request", "message": "Already exists"}}


def test_wrong_method_is_invalid_request(client: TestClient) -> None:
    response = client.post("/api/v1/health")

    assert response.status_code == 405
    _assert_api_error(response.json(), "invalid_request")


def test_unexpected_error_is_internal_without_details(client: TestClient) -> None:
    response = client.get("/api/v1/_test/boom")

    assert response.status_code == 500
    assert response.json() == {"error": {"code": "internal", "message": "Internal error"}}
    assert "secret detail" not in response.text
    assert "Traceback" not in response.text
