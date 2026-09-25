"""Live tick recorder (D11, D49): Kite WebSocket → `ticks` in batches, reconnecting with backoff."""

import asyncio
import json
import logging
from collections.abc import AsyncIterator, Awaitable, Callable
from contextlib import AbstractAsyncContextManager
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import Any, Protocol

from nova_broker.ticks import parse_ticks

logger = logging.getLogger("nova.broker.recorder")

KITE_WS = "wss://ws.kite.trade"
BATCH_SIZE = 500
BATCH_SECONDS = 1.0
MAX_BACKOFF_SECONDS = 30.0


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

    def __post_init__(self) -> None:
        self._last: dict[str, datetime] = {}
        self._buffer: list[dict[str, Any]] = []
        self._flushed = self.now()

    def _stamp(self, symbol: str) -> datetime:
        """Receive time, made unique per symbol (it is part of the primary key)."""
        stamp = self.now()
        last = self._last.get(symbol)
        if last is not None and stamp <= last:
            stamp = last + timedelta(microseconds=1)
        self._last[symbol] = stamp
        return stamp

    def _flush(self) -> None:
        if self._buffer:
            self.sink(self._buffer)
            self._buffer = []
        self._flushed = self.now()

    def _take(self, message: bytes) -> None:
        for tick in parse_ticks(message):
            symbol = self.symbols.get(tick.token)
            if symbol is None:
                continue
            self._buffer.append(
                {
                    "exchange": self.exchange,
                    "symbol": symbol,
                    "received_at": self._stamp(symbol),
                    "exchange_ts": tick.exchange_ts,
                    "last_price_paise": tick.last_price_paise,
                    "last_qty": tick.last_qty,
                    "volume": tick.volume,
                    "oi": tick.oi,
                }
            )
        due = (self.now() - self._flushed).total_seconds() >= BATCH_SECONDS
        if len(self._buffer) >= BATCH_SIZE or due:
            self._flush()

    async def _session(self) -> None:
        tokens = list(self.symbols)
        async with self.connect(self.url) as socket:
            await socket.send(json.dumps({"a": "subscribe", "v": tokens}))
            await socket.send(json.dumps({"a": "mode", "v": ["full", tokens]}))
            logger.info("Recording %s symbol(s)", len(tokens))
            async for message in socket:
                if isinstance(message, bytes):
                    self._take(message)
                if self.should_stop():
                    return

    async def run(self) -> None:
        """Records until `should_stop()`; any connection problem reconnects after 1, 2, 4 … 30 s."""
        backoff = 1.0
        while not self.should_stop():
            try:
                await self._session()
                backoff = 1.0
            except asyncio.CancelledError:
                raise
            except Exception as exc:  # network, protocol or server errors: all mean "reconnect"
                logger.warning("Tick socket dropped (%s); reconnecting in %.0f s", exc, backoff)
                self._flush()
                await self.sleep(backoff)
                backoff = min(backoff * 2, MAX_BACKOFF_SECONDS)
        self._flush()


def kite_url(api_key: str, access_token: str) -> str:
    return f"{KITE_WS}?api_key={api_key}&access_token={access_token}"
