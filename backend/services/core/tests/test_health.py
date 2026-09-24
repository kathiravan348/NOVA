from fastapi.testclient import TestClient
from nova_core.main import create_app
from nova_core.settings import CoreSettings


def test_health_returns_ok(dummy_settings: CoreSettings) -> None:
    response = TestClient(create_app(dummy_settings)).get("/api/v1/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
