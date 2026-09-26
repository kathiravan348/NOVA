import httpx2
import pytest
from fastapi.testclient import TestClient
from nova_broker.accounts import add_account
from nova_broker.cli import main
from nova_broker.main import create_app
from nova_broker.settings import BrokerSettings
from nova_testing.parity import Parity
from sqlalchemy import Engine
from sqlalchemy.orm import Session


def test_profile_is_synced_at_start_without_app_details(client: TestClient, parity: Parity) -> None:
    profiles = client.get("/api/v1/broker/profiles").json()
    zerodha = client.get("/api/v1/broker/profiles/zerodha").json()

    assert profiles == [zerodha]
    parity.assert_valid(zerodha, "BrokerProfile")
    assert "apiKeyLast4" not in zerodha and "plan" not in zerodha
    assert "kitekey" not in str(zerodha) and "kite-secret" not in str(zerodha)
    assert {link["kind"] for link in zerodha["links"]} >= {"docs", "rate_limits", "console"}


def test_without_env_keys_the_profile_exists_but_login_is_refused(
    settings: BrokerSettings,
) -> None:
    bare = settings.model_copy(update={"kite_api_key": None, "kite_api_secret": None})
    headers = {"x-nova-internal-token": "internal-test-token", "x-nova-user-id": "usr_owner"}
    headers["x-nova-user-name"] = "Owner"
    app = create_app(bare, kite_transport=httpx2.MockTransport(lambda r: httpx2.Response(500)))

    with TestClient(app, headers=headers) as client:
        assert client.get("/api/v1/broker/profiles/zerodha").status_code == 200
        login = client.get("/api/v1/broker/accounts/brk_x/login")
        assert login.status_code == 500
        assert "not configured" in login.json()["error"]["message"]


@pytest.mark.parametrize(
    ("label", "client_id", "message"),
    [("", "AB1234", "Label"), ("Main", "AB 1234", "Client id"), ("Main", "ab1234", "exists")],
)
def test_add_account_rejects_bad_input(
    clean: Engine, label: str, client_id: str, message: str
) -> None:
    with Session(clean) as db:
        add_account(db, label="First", client_id="AB1234")
        db.flush()
        with pytest.raises(ValueError, match=message):
            add_account(db, label=label, client_id=client_id)


def test_new_token_key_prints_a_fernet_key(capsys: pytest.CaptureFixture[str]) -> None:
    assert main(["new-token-key"]) == 0
    assert len(capsys.readouterr().out.strip()) == 44
