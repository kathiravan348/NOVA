"""Redis rate limiter for Kite calls (D27, D40). Every Kite request takes a slot first."""

import uuid
from dataclasses import dataclass
from datetime import UTC, datetime, time, timedelta
from importlib import resources
from zoneinfo import ZoneInfo

from redis import Redis

from nova_broker.limits import WINDOW_MS

IST = ZoneInfo("Asia/Kolkata")
PREFIX = "nova:rl"
_SCRIPT = resources.files("nova_broker").joinpath("limiter.lua").read_text("utf-8")


@dataclass(frozen=True)
class Decision:
    allowed: bool
    retry_after_ms: int


@dataclass(frozen=True)
class Usage:
    """`used`: peak today for second/minute windows, count so far for the day window."""

    used: dict[str, int]
    throttled_today: int


class RateLimiter:
    def __init__(self, redis: Redis, daily_reset: time) -> None:
        self._redis = redis
        self._reset = daily_reset
        self._script = redis.register_script(_SCRIPT)

    def period(self, now: datetime) -> tuple[str, datetime]:
        """The current daily period's name and when it ends (the next reset, UTC)."""
        local = now.astimezone(IST)
        start = datetime.combine(local.date(), self._reset, tzinfo=IST)
        if local < start:
            start -= timedelta(days=1)
        return start.strftime("%Y%m%dT%H%M"), (start + timedelta(days=1)).astimezone(UTC)

    def acquire(
        self, account_id: str, endpoint: str, limits: dict[str, int], now: datetime
    ) -> Decision:
        """Takes one slot in every window of `limits` (window → NOVA limit), or none at all."""
        period, next_reset = self.period(now)
        now_ms = int(now.timestamp() * 1000)
        until_reset = max(1, int((next_reset - now).total_seconds() * 1000))
        keys: list[str] = []
        args: list[str | int] = [now_ms, f"{now_ms}-{uuid.uuid4().hex}", len(limits), until_reset]
        for window, limit in limits.items():
            base = f"{PREFIX}:{account_id}:{endpoint}"
            keys.append(f"{base}:day:{period}" if window == "day" else f"{base}:{window}")
            keys.append(f"{PREFIX}:peak:{account_id}:{endpoint}:{window}:{period}")
            kind, span = ("day", until_reset) if window == "day" else ("roll", WINDOW_MS[window])
            args += [kind, limit, span, until_reset]
        keys.append(f"{PREFIX}:throttled:{account_id}:{endpoint}:{period}")
        allowed, wait = self._script(keys=keys, args=args)
        return Decision(allowed=bool(allowed), retry_after_ms=int(wait))

    def usage(self, account_id: str, endpoint: str, windows: list[str], now: datetime) -> Usage:
        period, _ = self.period(now)
        keys = [
            f"{PREFIX}:{account_id}:{endpoint}:day:{period}"
            if window == "day"
            else f"{PREFIX}:peak:{account_id}:{endpoint}:{window}:{period}"
            for window in windows
        ]
        keys.append(f"{PREFIX}:throttled:{account_id}:{endpoint}:{period}")
        values = self._redis.mget(keys)
        numbers = [int(v) if v is not None else 0 for v in values]
        return Usage(
            used=dict(zip(windows, numbers[:-1], strict=True)), throttled_today=numbers[-1]
        )
