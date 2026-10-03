"""Per-stock inputs of the intraday simulator (D84, `docs/INTRADAY-RESEARCH.md` §3, §6).

Every value belongs to one 1m bar `i` of the day and is known at that bar's close: it uses only 5m
bars that closed by then (today's, after the warm-up sessions' 5m bars) and 1m bars up to `i`.
- ATR: Wilder ATR(`atrPeriod`) of 5m true ranges, earlier sessions allowed (shared indicator maths).
- EMA(`contextEmaPeriod`) of 5m closes; **upward context** = last 5m close > VWAP and > EMA, and the
  EMA above its value 3 5m bars earlier. VWAP = Kite's session average price at the bar's last tick.
- **Range condition**: high − low of the last 6 completed 5m bars ≤ `rangeSpanAtr` × ATR.
- **Relative volume**: today's volume since the first minute at the elapsed minute ÷ the mean of the
  same over `volumeBaselineSessions` earlier sessions (the first minute is left out everywhere: it
  holds the pre-open auction in recorded bars but not in Kite's candles).
- Previous session high and low.
A value without enough data is NaN (or None) and makes the guard answer `warmup`, never a guess.
"""

import math
from dataclasses import dataclass, field
from datetime import UTC, datetime

import numpy as np
import numpy.typing as npt
from nova_contracts.research_profile import ResearchSignal

from nova_backtest.bars import IST
from nova_backtest.indicators_core import ema, wilder
from nova_backtest.intraday.tick_data import MINUTE_MS, Bars, session_ms

Floats = npt.NDArray[np.float64]
SESSION_MINUTES = 375
RANGE_BARS = 6
EMA_LOOKBACK = 3


@dataclass(frozen=True)
class DayBars:
    """One earlier session's 1m bars (warm-up): start (epoch ms), OHLC and volume, and where they
    came from (`recorded` ticks or Kite `history` candles)."""

    day_open_ms: int
    start: npt.NDArray[np.int64]
    high: npt.NDArray[np.int64]
    low: npt.NDArray[np.int64]
    close: npt.NDArray[np.int64]
    open: npt.NDArray[np.int64]
    volume: npt.NDArray[np.int64]
    source: str = "recorded"

    def __len__(self) -> int:
        return len(self.start)


@dataclass(frozen=True)
class History:
    """Earlier sessions, oldest first, as warm-up for one stock-day."""

    sessions: list[DayBars] = field(default_factory=list)


@dataclass(frozen=True)
class StockContext:
    atr: Floats
    ema: Floats
    ema_before: Floats  # the EMA 3 completed 5m bars earlier
    close5: Floats  # last completed 5m close
    span6: Floats  # high − low of the last 6 completed 5m bars
    vwap: Floats  # session average price at the bar's last tick (NaN = none)
    rel_volume: Floats
    prev_high: int | None
    prev_low: int | None
    sources: frozenset[
        str
    ]  # warm-up inputs taken from Kite history: atr, volume_baseline, prev_day

    def upward(self, i: int) -> bool | None:
        """Upward context at bar `i`; None when an input is missing."""
        values = (self.close5[i], self.vwap[i], self.ema[i], self.ema_before[i])
        if any(math.isnan(v) for v in values):
            return None
        close, vwap, average, before = values
        return bool(close > vwap and close > average and average > before)

    def in_range(self, i: int, span_atr: float) -> bool | None:
        if math.isnan(self.span6[i]) or math.isnan(self.atr[i]):
            return None
        return bool(self.span6[i] <= span_atr * self.atr[i])


def five_minute(day: DayBars) -> tuple[list[float], list[float], list[float]]:
    """A session's 1m bars rolled up into 5m bars from 09:15: highs, lows, closes."""
    if len(day) == 0:
        return [], [], []
    bucket = (day.start - day.day_open_ms) // (5 * MINUTE_MS)
    starts = np.flatnonzero(np.r_[True, bucket[1:] != bucket[:-1]])
    ends = np.r_[starts[1:], len(day)] - 1
    highs = np.maximum.reduceat(day.high, starts).astype(float).tolist()
    lows = np.minimum.reduceat(day.low, starts).astype(float).tolist()
    return highs, lows, day.close[ends].astype(float).tolist()


def cumulative_volume(
    start: npt.NDArray[np.int64], volume: npt.NDArray[np.int64], open_ms: int
) -> Floats:
    """Volume since the end of the first minute, at the end of each elapsed minute 1..375
    (index m − 1); minutes without a bar carry the last value."""
    out = np.zeros(SESSION_MINUTES, dtype=np.float64)
    if len(start) == 0:
        return out
    minute = ((start - open_ms) // MINUTE_MS).astype(np.int64)  # 0 = 09:15–09:16
    keep = (minute >= 1) & (minute < SESSION_MINUTES)
    per_minute = np.zeros(SESSION_MINUTES, dtype=np.float64)
    np.add.at(per_minute, minute[keep], volume[keep].astype(np.float64))
    return np.cumsum(per_minute)


def _true_ranges(highs: list[float], lows: list[float], closes: list[float]) -> list[float]:
    out: list[float] = []
    for k, (high, low) in enumerate(zip(highs, lows, strict=True)):
        if k == 0:
            out.append(high - low)
        else:
            prev = closes[k - 1]
            out.append(max(high - low, abs(high - prev), abs(low - prev)))
    return out


def _series(values: list[float | None]) -> Floats:
    return np.array([math.nan if v is None else v for v in values], dtype=np.float64)


def build_context(
    bars1: Bars, bars5: Bars, history: History, signal: ResearchSignal
) -> StockContext:
    """The context arrays of one stock-day (see the module text)."""
    n = len(bars1)
    hist_h: list[float] = []
    hist_l: list[float] = []
    hist_c: list[float] = []
    sources: set[str] = set()
    for session in history.sessions[-3:]:  # 3 sessions = 225 5m bars: enough for any period
        h, low, c = five_minute(session)
        hist_h, hist_l, hist_c = hist_h + h, hist_l + low, hist_c + c
        if session.source == "history":
            sources.add("atr")
    highs = hist_h + bars5.high.astype(float).tolist()
    lows = hist_l + bars5.low.astype(float).tolist()
    closes = hist_c + bars5.close.astype(float).tolist()
    period = signal.atr_period
    atr5 = _series(wilder(_true_ranges(highs, lows, closes), period, period - 1))
    ema5 = _series(ema(closes, signal.context_ema_period))
    # Index of the last 5m bar completed at each 1m close (−1 = none).
    done = np.searchsorted(bars5.end, bars1.end, side="right") + len(hist_c) - 1
    nan = np.full(n, math.nan)

    def pick(series: Floats, back: int = 0) -> Floats:
        index = done - back
        valid = (index >= 0) & (index < len(series))
        out = nan.copy()
        out[valid] = series[index[valid]]
        return out

    span = nan.copy()
    for i in range(n):
        j = int(done[i])
        if j >= RANGE_BARS - 1:
            span[i] = max(highs[j - RANGE_BARS + 1 : j + 1]) - min(lows[j - RANGE_BARS + 1 : j + 1])
    vwap = np.where(bars1.vwap > 0, bars1.vwap.astype(float), math.nan)
    rel = _relative_volume(bars1, history, signal.volume_baseline_sessions)
    if any(s.source == "history" for s in history.sessions[-signal.volume_baseline_sessions :]):
        sources.add("volume_baseline")
    prev = history.sessions[-1] if history.sessions else None
    if prev is not None and prev.source == "history":
        sources.add("prev_day")
    return StockContext(
        atr=pick(atr5),
        ema=pick(ema5),
        ema_before=pick(ema5, EMA_LOOKBACK),
        close5=pick(np.array(closes, dtype=np.float64)),
        span6=span,
        vwap=vwap,
        rel_volume=rel,
        prev_high=int(prev.high.max()) if prev is not None and len(prev) else None,
        prev_low=int(prev.low.min()) if prev is not None and len(prev) else None,
        sources=frozenset(sources),
    )


def _relative_volume(bars1: Bars, history: History, sessions: int) -> Floats:
    n = len(bars1)
    out = np.full(n, math.nan)
    baseline_days = history.sessions[-sessions:]
    if n == 0 or len(baseline_days) < sessions:
        return out
    profiles = [cumulative_volume(d.start, d.volume, d.day_open_ms) for d in baseline_days]
    mean = np.mean(np.vstack(profiles), axis=0)
    day_open = _day_open(bars1)
    today = cumulative_volume(bars1.start, bars1.volume, day_open)
    elapsed = ((bars1.end - day_open) // MINUTE_MS).astype(np.int64)  # minutes since 09:15
    for i in range(n):
        m = int(elapsed[i])
        if 2 <= m <= SESSION_MINUTES and mean[m - 1] > 0:
            out[i] = today[m - 1] / mean[m - 1]
    return out


def _day_open(bars1: Bars) -> int:
    """09:15 IST of the bars' day."""
    day = datetime.fromtimestamp(int(bars1.start[0]) / 1000, UTC).astimezone(IST).date()
    return session_ms(day)[0]
