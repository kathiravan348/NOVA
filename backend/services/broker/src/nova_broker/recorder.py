"""Live tick recorder (D11, D49): Kite WebSocket → `ticks` in batches, reconnecting with backoff.

Interruptions (D79): a failed save keeps the ticks for the next batch instead of dropping the
connection, and a socket that sends no stock tick for `STALL_SECONDS` is reconnected.
"""

import asyncio
import json
import logging
from collections.abc import AsyncIterator, Awaitable, Callable
from contextlib import AbstractAsyncContextManager
from dataclasses import asdict, dataclass
from datetime import UTC, datetime, timedelta
from typing import Any, Protocol

from nova_broker.ticks import parse_ticks

logger = logging.getLogger("nova.broker.recorder")

KITE_WS = "wss://ws.kite.trade"
BATCH_SIZE = 500
BATCH_SECONDS = 1.0
MAX_BACKOFF_SECONDS = 30.0
READ_TIMEOUT_SECONDS = 5.0
STALL_SECONDS = 60.0
MAX_BUFFER = 50_000


class Stalled(Exception):
    """The socket is open but no stock tick arrived for `STALL_SECONDS`."""


class Socket(Protocol):
    async def send(self, message: str) -> None: ...

    def __aiter__(self) -> AsyncIterator[str | bytes]: ...


Connect = Callable[[str], AbstractAsyncContextManager[Socket]]
# Any: a tick row is a dict of `ticks` column values for a bulk insert.
Sink = Callable[[list[dict[str, Any]]], None]


@dataclass
class Recorder:
    """`symbols`: instrument token → symbol. `now`, `sleep`, `connect` are injectable for tests."""

    url: str
    symbols: dict[int, str]
    sink: Sink
    connect: Connect
    should_stop: Callable[[], bool]
    now: Callable[[], datetime] = lambda: datetime.now(UTC)
    sleep: Callable[[float], Awaitable[None]] = asyncio.sleep
    exchange: str = "NSE"
    read_timeout: float = READ_TIMEOUT_SECONDS

    def __post_init__(self) -> None:
        self._last: dict[str, datetime] = {}
        self._buffer: list[dict[str, Any]] = []
        self._flushed = self.now()
        self._failing = False
        self._last_tick = self.now()
        self._received = 0

    def _stamp(self, symbol: str) -> datetime:
        """Receive time, made unique per symbol (it is part of the primary key)."""
        stamp = self.now()
        last = self._last.get(symbol)
        if last is not None and stamp <= last:
            stamp = last + timedelta(microseconds=1)
        self._last[symbol] = stamp
        return stamp

    def _flush(self) -> bool:
        """Saves the buffer; on failure keeps it (newest `MAX_BUFFER` rows) and returns False."""
        self._flushed = self.now()
        if not self._buffer:
            return True
        try:
            self.sink(self._buffer)
        except Exception:  # database trouble must not drop the socket: retry at the next batch
            logger.warning(
                "Saving %s tick(s) failed; keeping them for the next batch",
                len(self._buffer),
                exc_info=True,
            )
            self._failing = True
            dropped = len(self._buffer) - MAX_BUFFER
            if dropped > 0:
                self._buffer = self._buffer[dropped:]
                logger.warning(
                    "Dropped the %s oldest unsaved tick(s) (over %s)", dropped, MAX_BUFFER
                )
            return False
        self._buffer = []
        self._failing = False
        return True

    def _flush_if_due(self) -> None:
        # While saves fail, retry once per batch interval, not on every 500 rows.
        due = (self.now() - self._flushed).total_seconds() >= BATCH_SECONDS
        if due or (len(self._buffer) >= BATCH_SIZE and not self._failing):
            self._flush()

    def _take(self, message: bytes) -> None:
        for tick in parse_ticks(message):
            symbol = self.symbols.get(tick.token)
            if symbol is None:
                continue
            # Every tick field becomes a column (D77); each row has all keys for the bulk insert.
            row = asdict(tick)
            del row["token"]
            row |= {"exchange": self.exchange, "symbol": symbol, "received_at": self._stamp(symbol)}
            self._buffer.append(row)
            self._last_tick = self.now()
            self._received += 1
        self._flush_if_due()

    async def _session(self) -> None:
        """One connection, until `should_stop()` or the socket ends; raises to reconnect."""
        tokens = list(self.symbols)
        async with self.connect(self.url) as socket:
            await socket.send(json.dumps({"a": "subscribe", "v": tokens}))
            await socket.send(json.dumps({"a": "mode", "v": ["full", tokens]}))
            logger.info("Recording %s symbol(s)", len(tokens))
            self._last_tick = self.now()
            messages = aiter(socket)
            # One pending read kept across timeouts: cancelling it would close the iterator.
            pending = asyncio.ensure_future(anext(messages))
            try:
                while True:
                    done, _ = await asyncio.wait({pending}, timeout=self.read_timeout)
                    if done:
                        try:
                            message = pending.result()
                        except StopAsyncIteration:
                            return
                        pending = asyncio.ensure_future(anext(messages))
                        if isinstance(message, bytes):
                            self._take(message)
                    else:
                        self._flush_if_due()
                    if self.should_stop():
                        return
                    if (self.now() - self._last_tick).total_seconds() >= STALL_SECONDS:
                        raise Stalled(f"no ticks for {STALL_SECONDS:.0f} s")
            finally:
                pending.cancel()

    async def run(self) -> None:
        """Records until `should_stop()`; any connection problem reconnects after 1, 2, 4 … 30 s.

        The wait starts again at 1 s once a connection has received ticks.
        """
        backoff = 1.0
        while not self.should_stop():
            received = self._received
            try:
                await self._session()
                backoff = 1.0
            except asyncio.CancelledError:
                raise
            except Exception as exc:  # network, protocol, server errors or a stall: reconnect
                if self._received > received:
                    backoff = 1.0
                logger.warning("Tick socket dropped (%s); reconnecting in %.0f s", exc, backoff)
                self._flush()
                await self.sleep(backoff)
                backoff = min(backoff * 2, MAX_BACKOFF_SECONDS)
        if not self._flush():
            logger.error("Lost %s unsaved tick(s) at the end of the recording", len(self._buffer))


def kite_url(api_key: str, access_token: str) -> str:
    return f"{KITE_WS}?api_key={api_key}&access_token={access_token}"
