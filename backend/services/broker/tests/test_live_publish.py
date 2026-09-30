import threading
from collections.abc import Callable
from datetime import UTC, datetime

import pytest
from nova_broker.live_publish import publish_ticks
from nova_broker.recorder import Sink
from nova_broker.recorder_loop import RecorderLoop
from nova_contracts.live import LiveTick
from nova_db.models import DataJob, Tick
from redis import Redis
from redis.exceptions import ConnectionError
from sqlalchemy import Engine, func, select
from sqlalchemy.orm import Session, sessionmaker

AT = datetime(2026, 9, 30, 4, tzinfo=UTC)


def test_sink_stores_and_publishes_same_tick_without_kite(
    synced: Engine, redis_client: Redis
) -> None:
    with Session(synced) as db:
        db.add(
            DataJob(
                id="job_live",
                type="tick_record",
                status="running",
                exchange="NSE",
                segment="equity_delivery",
                symbols=["INFY"],
            )
        )
        db.commit()
    rows = [
        {
            "exchange": "NSE",
            "symbol": "INFY",
            "received_at": AT,
            "exchange_ts": None,
            "last_price_paise": 110,
            "last_qty": 1,
            "volume": 1,
            "oi": None,
        }
    ]
    # Redis 8.1's synchronous pubsub factory has no type annotation.
    with redis_client.pubsub() as channel:  # type: ignore[no-untyped-call]
        channel.subscribe("nova:ticks")
        channel.get_message(timeout=2)

        def record(url: str, tokens: dict[int, str], sink: Sink, stop: Callable[[], bool]) -> None:
            sink(rows)

        loop = RecorderLoop(
            factory=sessionmaker(bind=synced),
            cipher=None,
            stop=threading.Event(),
            record=record,
            now=lambda: AT,
            redis=redis_client,
        )
        loop._record("job_live", "fake", {1: "INFY"})
        message = channel.get_message(ignore_subscribe_messages=True, timeout=2)
    assert message is not None
    tick = LiveTick.model_validate_json(message["data"])
    assert tick.price == 110 and tick.at == AT
    with Session(synced) as db:
        assert db.scalar(select(func.count()).select_from(Tick)) == 1


def test_percentage_uses_integer_paise_previous_close(redis_client: Redis) -> None:
    row = {"symbol": "INFY", "last_price_paise": 110, "received_at": AT}
    # Redis 8.1's synchronous pubsub factory has no type annotation.
    with redis_client.pubsub() as channel:  # type: ignore[no-untyped-call]
        channel.subscribe("nova:ticks")
        channel.get_message(timeout=2)
        publish_ticks(redis_client, [row], {"INFY": 100})
        message = channel.get_message(ignore_subscribe_messages=True, timeout=2)
    assert message is not None
    assert LiveTick.model_validate_json(message["data"]).change_percent == 10


def test_redis_failure_does_not_interrupt_recording(
    redis_client: Redis, monkeypatch: pytest.MonkeyPatch
) -> None:
    def fail(*args: object, **kwargs: object) -> None:
        raise ConnectionError("unavailable")

    monkeypatch.setattr(redis_client, "pipeline", fail)
    publish_ticks(
        redis_client, [{"symbol": "INFY", "last_price_paise": 110, "received_at": AT}], {}
    )
