import pytest
from fastapi.testclient import TestClient
from nova_broker.accounts import add_account
from nova_broker.cli import main
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


def test_cli_keeps_only_setup_and_process_commands(capsys: pytest.CaptureFixture[str]) -> None:
    with pytest.raises(SystemExit):
        main(["--help"])
    out = capsys.readouterr().out
    assert "new-token-key" in out and "recorder" in out
    assert "add-account" not in out and "record-ticks" not in out


@pytest.mark.parametrize("command", ["add-account", "record-ticks"])
def test_removed_commands_are_refused(command: str) -> None:
    with pytest.raises(SystemExit) as exit_info:
        main([command])
    assert exit_info.value.code == 2


def test_new_token_key_prints_a_fernet_key(capsys: pytest.CaptureFixture[str]) -> None:
    assert main(["new-token-key"]) == 0
    assert len(capsys.readouterr().out.strip()) == 44
