"""The market gate of the intraday simulator (D84 (5), `docs/INTRADAY-RESEARCH.md` §2 Market, §6).

Index bars come from the recorded `index_ticks` of `marketIndex`; a day without index ticks uses
Kite's 1m index candles and is listed on the run (`index:<date>`). The index opening range (OR) is
its first `indexRangeMinutes`. At a decision time only completed index bars count:
- **trend gate**: the last completed 1m index close > the OR high;
- **range gate**: that close inside the OR and the index not down more than `declineVetoPercent`
  over the last 3 completed 5m bars (open of the first → close of the last).
No index bars (or an OR not complete yet) → the gate is closed (`market_gate`).
"""

from dataclasses import dataclass
from datetime import date

import numpy as np
from nova_contracts.research_profile import ResearchMarket
from nova_db.candles import read_bars
from sqlalchemy import text
from sqlalchemy.orm import Session

from nova_backtest.intraday.tick_data import (
    MINUTE_MS,
    Bars,
    DayTicks,
    at_ms,
    build_bars,
    session_ms,
)

DECLINE_BARS = 3

_INDEX_TICKS = text("""
    SELECT CAST(floor(extract(epoch FROM exchange_ts) * 1000) AS bigint) AS ts,
           last_price_paise AS ltp
    FROM index_ticks
    WHERE symbol = :index AND exchange_ts >= :open AND exchange_ts < :close
    ORDER BY exchange_ts, received_at
""")


def _bars_from_ticks(day: date, ts: list[int], ltp: list[int], width_ms: int) -> Bars:
    zeros = [0] * len(ts)
    columns = {
        "ts": np.array(ts, np.int64),
        "ltp": np.array(ltp, np.int64),
        "volume": np.array(zeros, np.int64),
        "vwap": np.array(zeros, np.int64),
        "bid": np.array(zeros, np.int64),
        "ask": np.array(zeros, np.int64),
    }
    return build_bars(DayTicks.from_arrays("index", day, columns), width_ms)


@dataclass(frozen=True)
class IndexGate:
    """One day's index bars and the gate's settings; `open` = False when the gate is off."""

    market: ResearchMarket
    bars1: Bars | None
    bars5: Bars | None
    open_ms: int

    @classmethod
    def load(cls, db: Session, market: ResearchMarket, day: date) -> tuple["IndexGate", str | None]:
        """The day's gate and the history input it used (`index:<date>`), if any."""
        open_ms, close_ms = session_ms(day)
        rows = db.execute(
            _INDEX_TICKS,
            {"index": market.market_index, "open": at_ms(open_ms), "close": at_ms(close_ms)},
        ).all()
        if rows:
            stamps, prices = [int(r.ts) for r in rows], [int(r.ltp) for r in rows]
            recorded = cls(
                market,
                _bars_from_ticks(day, stamps, prices, MINUTE_MS),
                _bars_from_ticks(day, stamps, prices, 5 * MINUTE_MS),
                open_ms,
            )
            return recorded, None
        candles = read_bars(db, "NSE", market.market_index, "1m", at_ms(open_ms), at_ms(close_ms))
        if not candles:
            return cls(market, None, None, open_ms), None
        # Each 1m candle as four ticks (open, high, low, close) inside its minute.
        ts: list[int] = []
        ltp: list[int] = []
        for row in candles:
            start = int(row.ts.timestamp() * 1000)
            for k, price in enumerate((row.open_paise, row.high_paise, row.low_paise)):
                ts.append(start + k * 10_000)
                ltp.append(price)
            ts.append(start + 59_000)
            ltp.append(row.close_paise)
        gate = cls(
            market,
            _bars_from_ticks(day, ts, ltp, MINUTE_MS),
            _bars_from_ticks(day, ts, ltp, 5 * MINUTE_MS),
            open_ms,
        )
        return gate, f"index:{day.isoformat()}"

    def _opening_range(self, at: int) -> tuple[int, int] | None:
        bars = self.bars1
        range_end = self.open_ms + self.market.index_range_minutes * MINUTE_MS
        if bars is None or at < range_end:
            return None
        inside = bars.start < range_end
        if not inside.any():
            return None
        return int(bars.high[inside].max()), int(bars.low[inside].min())

    def _last_close(self, at: int) -> int | None:
        bars = self.bars1
        if bars is None:
            return None
        done = int(np.searchsorted(bars.end, at, side="right"))
        return int(bars.close[done - 1]) if done else None

    def trend(self, at: int) -> bool:
        """Trend gate at decision time `at` (epoch ms)."""
        if not self.market.market_gate:
            return True
        span, close = self._opening_range(at), self._last_close(at)
        return span is not None and close is not None and close > span[0]

    def range(self, at: int) -> bool:
        """Range gate at decision time `at`: inside the OR and no decline veto."""
        if not self.market.market_gate:
            return True
        span, close = self._opening_range(at), self._last_close(at)
        if span is None or close is None or not span[1] <= close <= span[0]:
            return False
        return not self.declined(at)

    def declined(self, at: int) -> bool:
        bars = self.bars5
        if bars is None:
            return True
        done = int(np.searchsorted(bars.end, at, side="right"))
        if done < DECLINE_BARS:
            return False  # fewer than 3 completed 5m bars: nothing to veto yet
        first_open = int(bars.open[done - DECLINE_BARS])
        last_close = int(bars.close[done - 1])
        change = (last_close - first_open) * 100 / first_open
        return change < -self.market.decline_veto_percent
