"""Pullback and reclaim setups (D84, `docs/INTRADAY-RESEARCH.md` §3 rows 4–5).

- `vwap_trend_pullback` (family `trend`): while the session VWAP at the last `risingBars` completed
  5m bars is strictly rising (that many values, not that many rises), a **pullback bar** is a 1m bar
  whose low is within ± `proximityAtr` × ATR of the VWAP at its close. Within the next `expiryBars`
  bars a close > the pullback bar's high → candidate; stop = the lowest low since the pullback bar.
  A later pullback bar restarts the sequence; a close below that lowest low ends it.
- `failed_breakout_reclaim` (family `range`): a **break** is a 1m low < the previous session low;
  within the next `reclaimBars` bars (a recovery inside the break bar does not count) a close >
  that low → candidate; stop = the lowest low of the sequence. The target is frozen at the
  candidate: the session VWAP then (`exit: vwap`) or the midpoint of the stock's opening range
  (first 15 minutes, `range_mid`); the guard needs `minRewardR` room from the fill.
Missing VWAP, ATR or previous low → no candidate (ATR and baselines are the guard's `warmup`).
"""

import math

from nova_contracts import FailedBreakoutReclaim, IntradaySetup, VwapTrendPullback

from nova_backtest.intraday.setups import Candidate, StockDay, StockSetup
from nova_backtest.intraday.tick_data import MINUTE_MS, session_ms

RANGE_MID_MINUTES = 15


class Pullback:
    def __init__(self, stock: StockDay, setup: VwapTrendPullback) -> None:
        self.stock, self.setup = stock, setup
        self.pullback: int | None = None
        self.pullback_high = 0
        self.lowest = 0

    def _vwap_rising(self, i: int) -> bool:
        bars5, end = self.stock.bars5, int(self.stock.bars1.end[i])
        done = int((bars5.end <= end).sum())
        values = [int(v) for v in bars5.vwap[max(done - self.setup.rising_bars, 0) : done]]
        if len(values) < self.setup.rising_bars or min(values) <= 0:
            return False
        return all(b > a for a, b in zip(values, values[1:], strict=False))

    def _is_pullback(self, i: int) -> bool:
        context = self.stock.context
        if context is None:
            return False
        vwap, atr = float(context.vwap[i]), float(context.atr[i])
        if math.isnan(vwap) or math.isnan(atr):
            return False
        near = abs(int(self.stock.bars1.low[i]) - vwap) <= self.setup.proximity_atr * atr
        return near and self._vwap_rising(i)

    def on_bar(self, i: int) -> Candidate | None:
        bars = self.stock.bars1
        close, low = int(bars.close[i]), int(bars.low[i])
        if self.pullback is not None:
            if i - self.pullback > self.setup.expiry_bars or close < self.lowest:
                self.pullback = None
            elif close > self.pullback_high:
                stop = min(self.lowest, low)
                self.pullback = None
                return Candidate(
                    int(bars.end[i]), self.stock.symbol, self.setup.kind, "trend", i, close, stop,
                    target_r=self.setup.target_r,
                )  # fmt: skip
            else:
                self.lowest = min(self.lowest, low)
        if self._is_pullback(i):  # a later pullback bar restarts the sequence
            self.pullback, self.pullback_high, self.lowest = i, int(bars.high[i]), low
        return None


class Reclaim:
    def __init__(self, stock: StockDay, setup: FailedBreakoutReclaim) -> None:
        self.stock, self.setup = stock, setup
        self.level = None if stock.context is None else stock.context.prev_low
        self.broke: int | None = None
        self.lowest = 0

    def _target(self, i: int) -> int | None:
        if self.setup.exit == "vwap":
            vwap = math.nan if self.stock.context is None else float(self.stock.context.vwap[i])
            return None if math.isnan(vwap) else round(vwap)
        bars = self.stock.bars1
        open_ms, _ = session_ms(self.stock.day)
        inside = bars.start < open_ms + RANGE_MID_MINUTES * MINUTE_MS
        if (
            not len(bars)
            or int(bars.start[0]) != open_ms
            or int(bars.end[i]) <= open_ms + (RANGE_MID_MINUTES * MINUTE_MS)
        ):
            return None
        return round((int(bars.high[inside].max()) + int(bars.low[inside].min())) / 2)

    def on_bar(self, i: int) -> Candidate | None:
        if self.level is None:
            return None
        bars = self.stock.bars1
        close, low = int(bars.close[i]), int(bars.low[i])
        if self.broke is not None:
            if i - self.broke > self.setup.reclaim_bars:
                self.broke = None
            elif close > self.level:
                target, stop = self._target(i), min(self.lowest, low)
                self.broke = None
                if target is None:
                    return None
                return Candidate(
                    int(bars.end[i]), self.stock.symbol, self.setup.kind, "range", i, close, stop,
                    target=target, min_reward_r=self.setup.min_reward_r,
                )  # fmt: skip
            else:
                self.lowest = min(self.lowest, low)
        if self.broke is None and low < self.level:
            self.broke, self.lowest = i, low
        return None


def vwap_trend_pullback(setup: IntradaySetup, stock: StockDay) -> StockSetup:
    assert isinstance(setup, VwapTrendPullback)
    return Pullback(stock, setup)


def failed_breakout_reclaim(setup: IntradaySetup, stock: StockDay) -> StockSetup:
    assert isinstance(setup, FailedBreakoutReclaim)
    return Reclaim(stock, setup)
