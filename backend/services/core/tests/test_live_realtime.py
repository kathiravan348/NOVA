import asyncio
import json
import os
import time
from collections.abc import Iterator
from datetime import UTC, datetime

import httpx2
import pytest
from fastapi.testclient import TestClient
from nova_contracts.live import LiveTick
from nova_core.live_realtime import LiveFeed
from nova_core.main import create_app
from nova_core.realtime import Hub
from nova_core.settings import CoreSettings
from nova_testing.parity import Parity
from nova_testing.redis import redis_client
from redis import Redis
from sqlalchemy import Engine
from sqlalchemy.orm import sessionmaker

__all__ = ["redis_client"]


def payload(price: int = 100, symbol: str = "INFY", second: int = 0) -> str:
    return LiveTick(
        symbol=symbol,
        price=price,
        change_percent=None,
        at=datetime(2026, 9, 30, 4, 0, second, tzinfo=UTC),
        ticks_this_second=1,
    ).model_dump_json()


def test_coalesces_counts_latest_price_and_filters_selections(parity: Parity) -> None:
    async def run() -> None:
        feed = LiveFeed()
        chosen: asyncio.Queue[str] = asyncio.Queue()
        other: asyncio.Queue[str] = asyncio.Queue()
        feed.subscribe(chosen, '{"type":"live.subscribe","symbols":["INFY"]}')
        feed.subscribe(other, '{"type":"live.subscribe","symbols":["TCS"]}')
        for price in range(100, 110):
            feed.notice(payload(price))
        assert chosen.empty() and other.empty()
        first = json.loads(await asyncio.wait_for(chosen.get(), 2))
        assert first["data"]["price"] == 109 and first["data"]["ticksThisSecond"] == 10
        parity.assert_valid(first, "RealtimeMessage")
        assert other.empty() and chosen.empty()
        start = time.monotonic()
        feed.notice(payload(200, second=1))
        feed.notice(payload(201, second=1))
        second = json.loads(await asyncio.wait_for(chosen.get(), 2))
        assert time.monotonic() - start >= 0.99
        assert second["data"]["ticksThisSecond"] == 2
        assert other.empty()
        feed.unsubscribe(chosen)
        assert "INFY" not in feed.seconds

    asyncio.run(run())


def test_unsubscribed_socket_and_invalid_subscription_get_no_ticks() -> None:
    async def run() -> None:
        feed = LiveFeed()
        queue: asyncio.Queue[str] = asyncio.Queue()
        feed.notice(payload())
        assert not feed.tasks
        feed.subscribe(queue, '{"type":"live.subscribe","symbols":["INFY"]}')
        feed.subscribe(
            queue, json.dumps({"type": "live.subscribe", "symbols": [f"S{i}" for i in range(501)]})
        )
        assert feed.subscriptions[queue] == {"INFY"}
        feed.notice("invalid json")
        feed.notice(payload())
        feed.subscribe(queue, '{"type":"live.subscribe","symbols":[]}')
        await asyncio.sleep(1.05)
        assert queue.empty() and not feed.tasks

    asyncio.run(run())


def test_full_500_stock_flush_fits_socket_queue(
    core_settings: CoreSettings, engine: Engine
) -> None:
    async def run() -> None:
        hub = Hub(core_settings, sessionmaker(bind=engine))
        queue = hub.subscribe()
        symbols = [f"S{i}" for i in range(500)]
        hub.live.subscribe(queue, json.dumps({"type": "live.subscribe", "symbols": symbols}))
        for symbol in symbols:
            hub.live.notice(payload(symbol=symbol))
        await asyncio.sleep(1.05)
        assert queue.qsize() == 500
        assert {json.loads(queue.get_nowait())["data"]["symbol"] for _ in symbols} == set(symbols)
        hub.unsubscribe(queue)
        assert not hub.live.seconds

    asyncio.run(run())


@pytest.fixture
def live_client(
    core_settings: CoreSettings, admin: str, redis_client: Redis, credentials: dict[str, str]
) -> Iterator[TestClient]:
    settings = core_settings.model_copy(
        update={
            "redis_url": core_settings.redis_url.__class__(os.environ["NOVA_TEST_REDIS_URL"]),
            "atlas_url": "http://atlas:8000",
            "ws_ping_seconds": 0.1,
        }
    )
    transport = httpx2.MockTransport(lambda req: httpx2.Response(200, json={"path": req.url.path}))
    app = create_app(settings, upstream_transport=transport)
    with TestClient(app) as client:
        assert client.post("/api/v1/auth/login", json=credentials).status_code == 200
        assert client.portal is not None
        client.portal.call(asyncio.wait_for, app.state.realtime.live.ready.wait(), 3)
        yield client


def test_real_redis_to_subscribed_socket_and_unsubscribe(
    live_client: TestClient, redis_client: Redis, parity: Parity
) -> None:
    with live_client.websocket_connect("/api/v1/ws") as ws:
        assert ws.receive_json() == {"type": "hello"}
        redis_client.publish("nova:ticks", payload())
        assert ws.receive_json() == {"type": "ping"}  # no subscription, no tick
        ws.send_json({"type": "live.subscribe", "symbols": ["INFY"]})
        time.sleep(0.05)
        redis_client.publish("nova:ticks", payload(123))
        while (message := ws.receive_json())["type"] == "ping":
            pass
        assert message["type"] == "live.tick" and message["data"]["price"] == 123
        parity.assert_valid(message, "RealtimeMessage")
        ws.send_json({"type": "live.subscribe", "symbols": []})
        time.sleep(0.05)
        redis_client.publish("nova:ticks", payload(124, second=1))
        time.sleep(1.1)
        # Drain the queued pings; an unexpected tick anywhere would fail this assertion.
        for _ in range(10):
            assert ws.receive_json() == {"type": "ping"}


def test_live_routes_are_forwarded_through_core(live_client: TestClient) -> None:
    for path in ("/live/snapshot?symbols=INFY", "/live/days?symbol=INFY"):
        response = live_client.get("/api/v1" + path)
        assert response.status_code == 200
        assert response.json()["path"] == "/api/v1" + path.split("?")[0]


def test_agent_cannot_bypass_new_live_route_denial_on_the_socket(
    live_client: TestClient,
    agent: str,
    agent_credentials: dict[str, str],
    redis_client: Redis,
) -> None:
    live_client.post("/api/v1/auth/logout")
    assert live_client.post("/api/v1/auth/login", json=agent_credentials).status_code == 200
    assert live_client.get("/api/v1/live/snapshot?symbols=INFY").status_code == 403
    with live_client.websocket_connect("/api/v1/ws") as ws:
        assert ws.receive_json() == {"type": "hello"}
        ws.send_json({"type": "live.subscribe", "symbols": ["INFY"]})
        time.sleep(0.05)
        redis_client.publish("nova:ticks", payload())
        time.sleep(1.1)
        for _ in range(10):
            assert ws.receive_json() == {"type": "ping"}
