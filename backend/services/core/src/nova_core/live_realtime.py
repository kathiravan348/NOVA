"""Redis live ticks: selected stocks only, coalesced to one update per stock per second."""

import asyncio
import contextlib
import logging
from dataclasses import dataclass, field
from datetime import datetime

from nova_contracts.live import LiveSubscribe, LiveTick
from nova_contracts.realtime import LiveTickMessage
from pydantic import ValidationError
from redis.asyncio import Redis

log = logging.getLogger(__name__)
CHANNEL = "nova:ticks"
TICK_SECONDS = 1.0


@dataclass
class LiveFeed:
    ready: asyncio.Event = field(default_factory=asyncio.Event)
    subscriptions: dict[asyncio.Queue[str], set[str]] = field(default_factory=dict)
    pending: dict[str, LiveTick] = field(default_factory=dict)
    seconds: dict[str, tuple[datetime, int]] = field(default_factory=dict)
    tasks: dict[str, asyncio.Task[None]] = field(default_factory=dict)

    def subscribe(self, queue: asyncio.Queue[str], message: str) -> None:
        try:
            request = LiveSubscribe.model_validate_json(message)
        except ValidationError:
            return  # Invalid subscriptions leave the current selection intact.
        self.subscriptions[queue] = set(request.symbols)
        self._prune()

    def unsubscribe(self, queue: asyncio.Queue[str]) -> None:
        self.subscriptions.pop(queue, None)
        self._prune()

    def _prune(self) -> None:
        watched = set().union(*self.subscriptions.values()) if self.subscriptions else set()
        self.seconds = {
            symbol: count for symbol, count in self.seconds.items() if symbol in watched
        }

    def notice(self, payload: str | bytes) -> None:
        try:
            tick = LiveTick.model_validate_json(payload)
        except ValidationError:
            return
        if not any(tick.symbol in symbols for symbols in self.subscriptions.values()):
            return
        second = tick.at.replace(microsecond=0)
        prior = self.seconds.get(tick.symbol)
        if prior is not None and second < prior[0]:
            return
        count = (
            prior[1] + tick.ticks_this_second
            if prior and prior[0] == second
            else tick.ticks_this_second
        )
        self.seconds[tick.symbol] = (second, count)
        self.pending[tick.symbol] = tick.model_copy(update={"ticks_this_second": count})
        if tick.symbol not in self.tasks:
            self.tasks[tick.symbol] = asyncio.create_task(self._flush(tick.symbol))

    async def _flush(self, symbol: str) -> None:
        await asyncio.sleep(TICK_SECONDS)
        tick = self.pending.pop(symbol)
        message = LiveTickMessage(type="live.tick", data=tick).model_dump_json()
        for queue, symbols in list(self.subscriptions.items()):
            if symbol in symbols:
                with contextlib.suppress(asyncio.QueueFull):
                    queue.put_nowait(message)
        self.tasks.pop(symbol, None)
        # Keep counts only while the stock is watched; there are at most 500 per socket.
        if not any(symbol in symbols for symbols in self.subscriptions.values()):
            self.seconds.pop(symbol, None)

    async def listen_forever(self, url: str) -> None:
        backoff, down = 1.0, False
        try:
            while True:
                try:
                    async with (
                        Redis.from_url(url, socket_connect_timeout=2) as redis,
                        redis.pubsub() as channel,
                    ):
                        await channel.subscribe(CHANNEL)
                        self.ready.set()
                        backoff, down = 1.0, False
                        async for message in channel.listen():
                            # Redis metadata is untyped; validate the payload below.
                            if message["type"] == "message" and isinstance(
                                message["data"], (str, bytes)
                            ):
                                self.notice(message["data"])
                except asyncio.CancelledError:
                    raise
                except Exception:  # Redis outages only interrupt live delivery, not job events.
                    if not down:
                        log.warning("Live tick listener unavailable; retrying")
                    down = True
                    await asyncio.sleep(backoff)
                    backoff = min(backoff * 2, 30)
        finally:
            for task in self.tasks.values():
                task.cancel()
            await asyncio.gather(*self.tasks.values(), return_exceptions=True)
            self.tasks.clear()
            self.pending.clear()
            self.seconds.clear()
