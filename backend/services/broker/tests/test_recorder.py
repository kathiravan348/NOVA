"""The tick recorder with a fake socket and clock (D49)."""

import asyncio
import json
import struct
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from datetime import UTC, datetime, timedelta
from typing import Any

from nova_broker.recorder import BATCH_SIZE, Recorder, Socket

START = datetime(2026, 9, 25, 4, 0, tzinfo=UTC)


def ltp_frame(token: int, price: int) -> bytes:
    return struct.pack(">hh2i", 1, 8, token, price)


class Clock:
    def __init__(self) -> None:
        self.at = START

    def __call__(self) -> datetime:
        return self.at


class FakeSocket:
    def __init__(self, messages: list[str | bytes], clock: Clock, step: timedelta) -> None:
        self.messages, self.clock, self.step = messages, clock, step
        self.sent: list[object] = []
        self.exhausted = False

    async def send(self, message: str) -> None:
        self.sent.append(json.loads(message))

    async def __aiter__(self) -> AsyncIterator[str | bytes]:
        for message in self.messages:
            self.clock.at += self.step
            yield message
        self.exhausted = True


class Harness:
    """Hands out one scripted session per connect; an `OSError` entry makes that connect fail."""

    def __init__(self, sessions: list[list[str | bytes] | OSError], step: timedelta) -> None:
        self.clock, self.sessions, self.step = Clock(), sessions, step
        self.batches: list[list[dict[str, Any]]] = []
        self.sleeps: list[float] = []
        self.sockets: list[FakeSocket] = []

    @asynccontextmanager
    async def connect(self, url: str) -> AsyncIterator[Socket]:
        session = self.sessions.pop(0)
        if isinstance(session, OSError):
            raise session
        socket = FakeSocket(session, self.clock, self.step)
        self.sockets.append(socket)
        yield socket

    async def sleep(self, seconds: float) -> None:
        self.sleeps.append(seconds)

    def finished(self) -> bool:
        return not self.sessions and bool(self.sockets) and self.sockets[-1].exhausted

    def recorder(self, symbols: dict[int, str]) -> Recorder:
        return Recorder(
            url="wss://fake",
            symbols=symbols,
            sink=self.batches.append,
            connect=self.connect,
            should_stop=self.finished,
            now=self.clock,
            sleep=self.sleep,
        )


def run(harness: Harness, symbols: dict[int, str]) -> None:
    asyncio.run(harness.recorder(symbols).run())


def test_subscribes_in_full_mode_and_batches_by_time() -> None:
    messages: list[str | bytes] = [ltp_frame(1, 100)] * 5
    harness = Harness([[*messages, b"\x00", "text"]], timedelta(milliseconds=300))
    run(harness, {1: "INFY"})
    assert harness.sockets[0].sent == [
        {"a": "subscribe", "v": [1]},
        {"a": "mode", "v": ["full", [1]]},
    ]
    assert [len(b) for b in harness.batches] == [4, 1]
    row = harness.batches[0][0]
    assert (row["exchange"], row["symbol"], row["last_price_paise"]) == ("NSE", "INFY", 100)


def test_batches_by_size_and_unique_receive_times() -> None:
    harness = Harness([[ltp_frame(1, 100)] * (BATCH_SIZE + 3)], timedelta(0))
    run(harness, {1: "INFY"})
    assert [len(b) for b in harness.batches] == [BATCH_SIZE, 3]
    stamps = [row["received_at"] for batch in harness.batches for row in batch]
    assert len(set(stamps)) == len(stamps)


def test_unknown_tokens_are_dropped() -> None:
    harness = Harness([[ltp_frame(1, 100), ltp_frame(2, 200)]], timedelta(seconds=2))
    run(harness, {2: "TCS"})
    assert [row["symbol"] for batch in harness.batches for row in batch] == ["TCS"]


def test_reconnects_with_doubling_backoff_capped_at_30_seconds() -> None:
    sessions: list[list[str | bytes] | OSError] = [OSError("down")] * 7 + [[ltp_frame(1, 5)]]
    harness = Harness(sessions, timedelta(seconds=2))
    run(harness, {1: "INFY"})
    assert harness.sleeps == [1, 2, 4, 8, 16, 30, 30]
    assert len(harness.sockets) == 1
    assert [len(b) for b in harness.batches] == [1]


def test_stops_mid_session() -> None:
    harness = Harness([[ltp_frame(1, 5)] * 3], timedelta(milliseconds=1))
    recorder = harness.recorder({1: "INFY"})
    recorder.should_stop = lambda: harness.clock.at > START
    asyncio.run(recorder.run())
    assert sum(len(b) for b in harness.batches) == 1
