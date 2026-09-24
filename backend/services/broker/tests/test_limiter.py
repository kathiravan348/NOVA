"""The Redis limiter with a controlled clock (D40)."""

from datetime import UTC, datetime, time, timedelta
from zoneinfo import ZoneInfo

import pytest
from nova_broker.limiter import RateLimiter
from redis import Redis

IST = ZoneInfo("Asia/Kolkata")
T0 = datetime(2026, 9, 24, 10, 0, tzinfo=IST).astimezone(UTC)


@pytest.fixture
def limiter(redis_client: Redis) -> RateLimiter:
    return RateLimiter(redis_client, time(0, 0))


def _take(limiter: RateLimiter, limits: dict[str, int], at: datetime) -> tuple[bool, int]:
    decision = limiter.acquire("brk_1", "orders", limits, at)
    return decision.allowed, decision.retry_after_ms


def test_second_window_allows_the_limit_then_waits(limiter: RateLimiter) -> None:
    limits = {"second": 3}
    results = [_take(limiter, limits, T0 + timedelta(milliseconds=i * 100)) for i in range(4)]

    assert [allowed for allowed, _ in results] == [True, True, True, False]
    assert results[3][1] == 700  # the first slot frees 1 s after it was taken
    assert _take(limiter, limits, T0 + timedelta(seconds=1))[0]


def test_a_denied_call_takes_nothing_from_other_windows(limiter: RateLimiter) -> None:
    limits = {"second": 2, "minute": 3}

    assert _take(limiter, limits, T0)[0] and _take(limiter, limits, T0)[0]
    assert not _take(limiter, limits, T0)[0]  # second window full; minute still at 2
    assert _take(limiter, limits, T0 + timedelta(seconds=1))[0]  # minute now 3
    allowed, wait = _take(limiter, limits, T0 + timedelta(seconds=2))

    assert not allowed
    assert wait == 58_000  # the oldest minute entry (T0) frees at T0 + 60 s


def test_day_window_resets_at_the_configured_ist_time(redis_client: Redis) -> None:
    limiter = RateLimiter(redis_client, time(6, 0))
    before_reset = datetime(2026, 9, 25, 5, 59, tzinfo=IST).astimezone(UTC)

    assert _take(limiter, {"day": 2}, T0)[0] and _take(limiter, {"day": 2}, T0)[0]
    allowed, wait = _take(limiter, {"day": 2}, before_reset)
    assert not allowed and wait == 60_000
    assert _take(limiter, {"day": 2}, before_reset + timedelta(minutes=1))[0]


def test_period_and_next_reset(limiter: RateLimiter) -> None:
    late = datetime(2026, 9, 24, 23, 59, tzinfo=IST)

    assert limiter.period(late) == ("20260924T0000", datetime(2026, 9, 24, 18, 30, tzinfo=UTC))


def test_usage_reports_peaks_counts_and_throttling(limiter: RateLimiter) -> None:
    limits = {"second": 2, "minute": 10, "day": 100}
    for offset in (0, 100, 200, 1_500):  # third call is throttled by the second window
        limiter.acquire("brk_1", "orders", limits, T0 + timedelta(milliseconds=offset))

    usage = limiter.usage("brk_1", "orders", ["second", "minute", "day"], T0 + timedelta(seconds=2))

    assert usage.used == {"second": 2, "minute": 3, "day": 3}
    assert usage.throttled_today == 1


def test_accounts_and_endpoints_do_not_share_slots(limiter: RateLimiter) -> None:
    assert limiter.acquire("brk_1", "quote", {"second": 1}, T0).allowed
    assert limiter.acquire("brk_2", "quote", {"second": 1}, T0).allowed
    assert limiter.acquire("brk_1", "historical", {"second": 1}, T0).allowed
    assert not limiter.acquire("brk_1", "quote", {"second": 1}, T0).allowed
