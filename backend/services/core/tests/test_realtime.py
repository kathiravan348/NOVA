import time
from collections.abc import Iterator
from typing import Any

import pytest
from fastapi.testclient import TestClient
from nova_core.main import create_app
from nova_core.settings import CoreSettings
from nova_db import new_id
from nova_db.models import DataJob
from nova_testing.parity import Parity
from sqlalchemy import Engine, update
from sqlalchemy.orm import Session
from starlette.testclient import WebSocketTestSession
from starlette.websockets import WebSocketDisconnect

WS = "/api/v1/ws"


def _add_job(engine: Engine) -> str:
    job_id = new_id("job")
    with Session(engine) as db:
        db.add(
            DataJob(
                id=job_id,
                type="tick_record",
                status="running",
                exchange="NSE",
                segment="equity_intraday",
                symbols=["INFY"],
            )
        )
        db.commit()
    return job_id


def _set_rows(engine: Engine, job_id: str, rows: int) -> None:
    with Session(engine) as db:
        db.execute(update(DataJob).where(DataJob.id == job_id).values(rows_written=rows))
        db.commit()


def _next_job_message(ws: WebSocketTestSession) -> dict[str, Any]:
    while True:
        message: dict[str, Any] = ws.receive_json()
        if message["type"] == "data_job.updated":
            return message


def test_no_cookie_is_closed_with_4401(client: TestClient) -> None:
    with client.websocket_connect(WS) as ws, pytest.raises(WebSocketDisconnect) as closed:
        ws.receive_json()

    assert closed.value.code == 4401


def test_signed_in_gets_hello_then_job_updates(
    signed_in: TestClient, engine: Engine, parity: Parity
) -> None:
    with signed_in.websocket_connect(WS) as ws:
        assert ws.receive_json() == {"type": "hello"}

        job_id = _add_job(engine)
        created = _next_job_message(ws)
        _set_rows(engine, job_id, 42)
        changed = _next_job_message(ws)

    assert created["data"]["id"] == job_id
    assert changed["data"]["rowsWritten"] == 42
    parity.assert_valid(changed, "RealtimeMessage")


def test_quick_updates_of_one_job_are_coalesced(signed_in: TestClient, engine: Engine) -> None:
    with signed_in.websocket_connect(WS) as ws:
        ws.receive_json()
        job_id = _add_job(engine)
        start = time.monotonic()
        for rows in range(1, 11):
            _set_rows(engine, job_id, rows)
        assert time.monotonic() - start < 0.25
        time.sleep(0.6)
        marker = _add_job(engine)  # a later job: every message for the first one is before it

        seen: list[dict[str, Any]] = []
        while (message := _next_job_message(ws))["data"]["id"] != marker:
            seen.append(message)

    # The insert and the ten updates arrive as 1-2 messages; the last has the final state.
    assert 1 <= len(seen) <= 2
    assert seen[-1]["data"]["rowsWritten"] == 10


@pytest.fixture
def quick_client(core_settings: CoreSettings, admin: str) -> Iterator[TestClient]:
    settings = core_settings.model_copy(
        update={"ws_ping_seconds": 0.1, "ws_session_check_seconds": 0.2}
    )
    with TestClient(create_app(settings)) as test_client:
        yield test_client


def test_ping_and_close_when_the_session_is_revoked(
    quick_client: TestClient, credentials: dict[str, str]
) -> None:
    assert quick_client.post("/api/v1/auth/login", json=credentials).status_code == 200
    with quick_client.websocket_connect(WS) as ws:
        assert ws.receive_json() == {"type": "hello"}
        assert ws.receive_json() == {"type": "ping"}
        ws.send_json({"type": "pong"})
        cookie = quick_client.cookies.get("nova_session")
        assert quick_client.post("/api/v1/auth/logout").status_code == 204

        with pytest.raises(WebSocketDisconnect) as closed:
            while True:
                ws.receive_json()

    assert cookie
    assert closed.value.code == 4401
