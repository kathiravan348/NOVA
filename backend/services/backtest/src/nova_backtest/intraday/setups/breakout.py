"""Breakout setups, family `trend` (D84, `docs/INTRADAY-RESEARCH.md` §3 rows 1–3).

Each is a state machine per stock and day fed completed 1m bars. Buffer = `bufferAtr` × the ATR at
the bar (no ATR yet → no buffer: the candidate still reaches the guard, which answers `warmup`).
- `opening_range_retest`: the opening range (OR) is the stock's first `rangeMinutes` from 09:15 (it
  needs a bar in the first minute and a non-zero width). **Breakout**: a close > OR high + buffer
  after the OR. **Retest**: within the next `retestBars` bars (never the breakout bar itself) a bar
  with low ≤ OR high and close > OR high + buffer → candidate at its close, stop = its low.
  A close below the OR high, or the window running out, ends the sequence; a later breakout may
  start a new one.
- `prev_day_high_retest`: the same around the previous session's high (none → no setup).
- `inside_bar_continuation`: bar *i* strictly inside bar *i − 1* (lower high, higher low); within
  the next `expiryBars` bars a close > mother high + buffer → candidate, stop = mother low. A close
  below the mother low ends it; inside bars during a sequence do not restart its expiry.
Targets: `targetR` × R from the first fill (the simulator fixes the price then).
"""

import math

from nova_contracts import (
    InsideBarContinuation,
    IntradaySetup,
    OpeningRangeRetest,
    PrevDayHighRetest,
)

from nova_backtest.intraday.setups import Candidate, StockDay, StockSetup
from nova_backtest.intraday.tick_data import MINUTE_MS, session_ms


def _buffer(stock: StockDay, i: int, multiple: float) -> int:
    atr = math.nan if stock.context is None else float(stock.context.atr[i])
    return 0 if math.isnan(atr) else round(multiple * atr)


class LevelRetest:
    """Breakout above a level, then a retest that holds it (`opening_range_retest`,
    `prev_day_high_retest`)."""

    def __init__(
        self,
        stock: StockDay,
        kind: str,
        level: int | None,
        active_from_ms: int,
        retest_bars: int,
        buffer_atr: float,
        target_r: float,
    ) -> None:
        self.stock, self.kind, self.level = stock, kind, level
        self.active_from_ms, self.retest_bars = active_from_ms, retest_bars
        self.buffer_atr, self.target_r = buffer_atr, target_r
        self.breakout: int | None = None

    def on_bar(self, i: int) -> Candidate | None:
        bars, level = self.stock.bars1, self.level
        if level is None or int(bars.start[i]) < self.active_from_ms:
            return None
        trigger = level + _buffer(self.stock, i, self.buffer_atr)
        close, low = int(bars.close[i]), int(bars.low[i])
        if self.breakout is not None:
            if i - self.breakout > self.retest_bars or close < level:
                self.breakout = None  # expired or failed
            elif low <= level and close > trigger:
                self.breakout = None
                return Candidate(
                    int(bars.end[i]), self.stock.symbol, self.kind, "trend", i, close, low,
                    target_r=self.target_r,
                )  # fmt: skip
        if self.breakout is None and close > trigger:
            self.breakout = i
        return None


class InsideBar:
    """`inside_bar_continuation`."""

    def __init__(self, stock: StockDay, setup: InsideBarContinuation) -> None:
        self.stock, self.setup = stock, setup
        self.inside: int | None = None
        self.mother_high = self.mother_low = 0

    def on_bar(self, i: int) -> Candidate | None:
        bars = self.stock.bars1
        if self.inside is not None:
            close = int(bars.close[i])
            if i - self.inside > self.setup.expiry_bars or close < self.mother_low:
                self.inside = None
            elif close > self.mother_high + _buffer(self.stock, i, self.setup.buffer_atr):
                self.inside = None
                return Candidate(
                    int(bars.end[i]), self.stock.symbol, self.setup.kind, "trend", i, close,
                    self.mother_low, target_r=self.setup.target_r,
                )  # fmt: skip
        if self.inside is None and i >= 1:
            high, low = int(bars.high[i]), int(bars.low[i])
            if high < int(bars.high[i - 1]) and low > int(bars.low[i - 1]):
                self.inside = i
                self.mother_high, self.mother_low = int(bars.high[i - 1]), int(bars.low[i - 1])
        return None


def opening_range(stock: StockDay, minutes: int) -> int | None:
    """The OR high, or None when the stock has no first-minute bar or a zero-width range."""
    bars = stock.bars1
    open_ms, _ = session_ms(stock.day)
    end = open_ms + minutes * MINUTE_MS
    inside = bars.start < end
    if not len(bars) or int(bars.start[0]) != open_ms or not inside.any():
        return None
    high, low = int(bars.high[inside].max()), int(bars.low[inside].min())
    return high if high > low else None


def opening_range_retest(setup: IntradaySetup, stock: StockDay) -> StockSetup:
    assert isinstance(setup, OpeningRangeRetest)
    open_ms, _ = session_ms(stock.day)
    return LevelRetest(
        stock,
        setup.kind,
        opening_range(stock, setup.range_minutes),
        open_ms + setup.range_minutes * MINUTE_MS,
        setup.retest_bars,
        setup.buffer_atr,
        setup.target_r,
    )


def prev_day_high_retest(setup: IntradaySetup, stock: StockDay) -> StockSetup:
    assert isinstance(setup, PrevDayHighRetest)
    level = None if stock.context is None else stock.context.prev_high
    return LevelRetest(
        stock,
        setup.kind,
        level,
        session_ms(stock.day)[0],
        setup.retest_bars,
        setup.buffer_atr,
        setup.target_r,
    )


def inside_bar_continuation(setup: IntradaySetup, stock: StockDay) -> StockSetup:
    assert isinstance(setup, InsideBarContinuation)
    return InsideBar(stock, setup)
