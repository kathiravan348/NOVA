"""The intraday fill model (D84, `docs/INTRADAY-RESEARCH.md` §5.5). Pure functions on quotes.

A buy is tried at decision + delay. The quote it uses is the first of: the latest tick at or before
that moment, if it is at most `maxQuoteAgeMs` old, then each later tick up to that age after the
moment; the first of them with an ask is used. None of them → `stale_quote`; ticks without an ask →
`no_quote`. On that tick: no bid or a spread above `maxSpreadBps` → `wide_spread`; spread above
`maxSpreadToStopPercent` of (ask − stop) → `spread_to_stop`; then the ask levels are walked using at
most `maxDepthPercent` of each level's quantity, each level priced + slippage ticks × tick size; a
supported quantity below `minFillPercent` of the request → `too_little_depth`, else the filled part
is kept. A level a fill used on a tick is not used again until a newer tick (`LevelUse`).
Sells walk the bid levels the same way (− slippage) and never refuse: the rest waits for later
ticks.
"""

import math
from collections.abc import Callable
from dataclasses import dataclass, field
from typing import Literal

import numpy as np

from nova_backtest.intraday.tick_data import DayTicks, Depth

Side = Literal["buy", "sell"]


@dataclass(frozen=True)
class Execution:
    """The fill settings of a run's scenario (base or stress) from its research profile."""

    delay_ms: int
    slippage_ticks: int
    max_quote_age_ms: int
    max_spread_bps: float
    max_spread_to_stop_percent: float
    max_depth_percent: float
    min_fill_percent: float


@dataclass(frozen=True)
class Fill:
    tick: int  # index of the tick whose depth was used
    at_ms: int  # that tick's exchange time, or the attempt moment when the tick is older
    qty: int
    value: int  # Σ shares × price in paise (exact)
    spread: int  # that tick's ask − bid (paise)

    @property
    def price(self) -> float:
        return self.value / self.qty


@dataclass(frozen=True)
class Refusal:
    first: str
    reasons: tuple[str, ...]


@dataclass
class LevelUse:
    """Levels already used per (symbol, side) on its newest tick."""

    used: dict[tuple[str, str], tuple[int, set[int]]] = field(default_factory=dict)

    def taken(self, symbol: str, side: Side, tick: int) -> set[int]:
        key = (symbol, side)
        known = self.used.get(key)
        if known is None or known[0] != tick:
            self.used[key] = (tick, set())
        return self.used[key][1]


# (ticks, lo, hi) → (index of the first row returned, levels of ticks lo..hi − 1 or a few more)
DepthFetch = Callable[[DayTicks, int, int], tuple[int, Depth]]


class DepthAt:
    """Depth of one tick (a 1-row `Depth`) through a `DepthFetch`, with one cached window per
    stock-day so retries on later ticks do not read again."""

    def __init__(self, fetch: DepthFetch, window: int = 400) -> None:
        self.fetch, self.window = fetch, window
        self._cache: dict[tuple[str, int], tuple[int, Depth]] = {}

    def __call__(self, ticks: DayTicks, i: int) -> Depth:
        key = (ticks.symbol, ticks.day.toordinal())
        cached = self._cache.get(key)
        if cached is None or not cached[0] <= i < cached[0] + len(cached[1].bid_px):
            cached = self.fetch(ticks, i, min(i + self.window, len(ticks)))
            self._cache[key] = cached
        start, depth = cached
        if not start <= i < start + len(depth.bid_px):
            return Depth.zeros(1)
        k = i - start
        return Depth(
            depth.bid_px[k : k + 1],
            depth.bid_qty[k : k + 1],
            depth.ask_px[k : k + 1],
            depth.ask_qty[k : k + 1],
        )

    def clear(self) -> None:
        self._cache.clear()


def walk(
    prices: np.ndarray,
    quantities: np.ndarray,
    want: int,
    side: Side,
    execution: Execution,
    tick_size: int,
    taken: set[int],
) -> list[tuple[int, int]]:
    """(shares, price) per level, best first, up to `want`; marks used levels in `taken`."""
    out: list[tuple[int, int]] = []
    left = want
    slip = execution.slippage_ticks * tick_size
    for level in range(len(prices)):
        price, qty = int(prices[level]), int(quantities[level])
        if left <= 0:
            break
        if level in taken or price <= 0 or qty <= 0:
            continue
        usable = math.floor(qty * execution.max_depth_percent / 100)
        take = min(usable, left)
        if take <= 0:
            continue
        paid = price + slip if side == "buy" else max(price - slip, tick_size)
        out.append((take, paid))
        taken.add(level)
        left -= take
    return out


def quote_ticks(ticks: DayTicks, attempt_ms: int, max_age_ms: int) -> list[int]:
    """Tick indexes a buy at `attempt_ms` may use, in order (see the module text)."""
    latest = int(np.searchsorted(ticks.ts, attempt_ms, side="right")) - 1
    fresh = latest >= 0 and attempt_ms - int(ticks.ts[latest]) <= max_age_ms
    first = latest if fresh else latest + 1
    last = int(np.searchsorted(ticks.ts, attempt_ms + max_age_ms, side="right"))
    return list(range(max(first, 0), last))


def buy(
    ticks: DayTicks,
    depth_at: DepthAt,
    attempt_ms: int,
    want: int,
    stop: int,
    execution: Execution,
    tick_size: int,
    levels: LevelUse,
) -> Fill | Refusal:
    """One buy attempt of `want` shares (see the module text)."""
    candidates = quote_ticks(ticks, attempt_ms, execution.max_quote_age_ms)
    if not candidates:
        return Refusal("stale_quote", ("stale_quote",))
    with_ask = [i for i in candidates if int(ticks.ask[i]) > 0]
    if not with_ask:
        return Refusal("no_quote", ("no_quote",))
    i = with_ask[0]
    ask, bid = int(ticks.ask[i]), int(ticks.bid[i])
    reasons: list[str] = []
    spread = ask - bid if bid > 0 else 0
    if bid <= 0 or spread * 10_000 > execution.max_spread_bps * (ask + bid) / 2:
        reasons.append("wide_spread")
    room = ask - stop
    if room > 0 and bid > 0 and spread * 100 > execution.max_spread_to_stop_percent * room:
        reasons.append("spread_to_stop")
    depth = depth_at(ticks, i)
    taken = levels.taken(ticks.symbol, "buy", i)
    parts = walk(depth.ask_px[0], depth.ask_qty[0], want, "buy", execution, tick_size, set(taken))
    got = sum(q for q, _ in parts)
    if got <= 0 or got * 100 < execution.min_fill_percent * want:
        reasons.append("too_little_depth")
    if reasons:
        return Refusal(reasons[0], tuple(reasons))
    walk(depth.ask_px[0], depth.ask_qty[0], want, "buy", execution, tick_size, taken)
    at = max(int(ticks.ts[i]), attempt_ms)
    return Fill(i, at, got, sum(q * p for q, p in parts), spread)


def sell(
    ticks: DayTicks,
    depth_at: DepthAt,
    i: int,
    want: int,
    execution: Execution,
    tick_size: int,
    levels: LevelUse,
) -> Fill | None:
    """Sells up to `want` shares into tick `i`'s bid levels; None when nothing could be sold."""
    if int(ticks.bid[i]) <= 0:
        return None
    depth = depth_at(ticks, i)
    taken = levels.taken(ticks.symbol, "sell", i)
    parts = walk(depth.bid_px[0], depth.bid_qty[0], want, "sell", execution, tick_size, taken)
    got = sum(q for q, _ in parts)
    if got <= 0:
        return None
    ask = int(ticks.ask[i])
    spread = ask - int(ticks.bid[i]) if ask > 0 else 0
    return Fill(i, int(ticks.ts[i]), got, sum(q * p for q, p in parts), spread)
