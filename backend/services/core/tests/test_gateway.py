from collections.abc import Iterator

import httpx2
import pytest
from fastapi.testclient import TestClient
from nova_core.main import create_app
from nova_core.sessions import COOKIE_NAME
from nova_core.settings import CoreSettings


class Upstream:
    """Fake services: records every forwarded request and answers 200 with a JSON echo."""

    def __init__(self) -> None:
        self.requests: list[httpx2.Request] = []
        self.fail = False

    def handle(self, request: httpx2.Request) -> httpx2.Response:
        if self.fail:
            raise httpx2.ConnectError("refused", request=request)
        self.requests.append(request)
        return httpx2.Response(201, json={"echo": request.url.path})


@pytest.fixture
def upstream() -> Upstream:
    return Upstream()


@pytest.fixture
def gateway(
    core_settings: CoreSettings, admin: str, upstream: Upstream, credentials: dict[str, str]
) -> Iterator[TestClient]:
    app = create_app(core_settings, upstream_transport=httpx2.MockTransport(upstream.handle))
    with TestClient(app) as client:
        assert client.post("/api/v1/auth/login", json=credentials).status_code == 200
        yield client


def test_forwards_with_user_headers_and_without_cookies(
    gateway: TestClient, upstream: Upstream, admin: str, internal_token: str
) -> None:
    response = gateway.patch(
        "/api/v1/broker/rate-limits/brk_1/orders?dry=1",
        json={"window": "day", "novaLimit": 4500},
    )

    assert response.status_code == 201
    assert response.json() == {"echo": "/api/v1/broker/rate-limits/brk_1/orders"}
    sent = upstream.requests[0]
    assert str(sent.url) == "http://broker:8001/api/v1/broker/rate-limits/brk_1/orders?dry=1"
    assert sent.method == "PATCH"
    assert sent.headers["x-nova-user-id"] == admin
    assert sent.headers["x-nova-user-name"] == "Aarav%20Sharma"
    assert sent.headers["x-nova-internal-token"] == internal_token
    assert "cookie" not in sent.headers
    assert sent.content == b'{"window":"day","novaLimit":4500}'


def test_needs_a_session(gateway: TestClient, upstream: Upstream) -> None:
    gateway.cookies.delete(COOKIE_NAME)

    response = gateway.get("/api/v1/broker/accounts")

    assert response.status_code == 401
    assert upstream.requests == []


def test_service_without_url_is_bad_gateway(gateway: TestClient) -> None:
    response = gateway.get("/api/v1/strategies")

    assert response.status_code == 502
    assert response.json()["error"] == {
        "code": "internal",
        "message": "The strategies service is not available yet",
    }


def test_unreachable_service_is_bad_gateway(gateway: TestClient, upstream: Upstream) -> None:
    upstream.fail = True

    response = gateway.get("/api/v1/broker/accounts")

    assert response.status_code == 502
    assert response.json()["error"]["code"] == "internal"
