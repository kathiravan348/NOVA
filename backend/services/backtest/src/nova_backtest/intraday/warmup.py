"""Warm-up sessions of the intraday simulator (D84 (6), `docs/INTRADAY-RESEARCH.md` §6).

ATR, EMA, the volume baseline and the previous session's levels need sessions before the day. For
each stock the earlier trading days are its recorded days (`tick_days`) and its Kite 1m candle days
(`candle_days`); a day with recorded ticks uses 1m bars built from them (D82 rules), any other day
Kite's 1m candles, and those inputs are listed on the run (`history_inputs`). Days the run itself
replayed are kept from the replay. Fills never use any of this.
"""

from datetime import UTC, date, datetime, time, timedelta
from pathlib import Path

import numpy as np
from nova_db.candles import BarRow, read_bars
from nova_db.models import CandleDay, TickDay
from sqlalchemy import select
from sqlalchemy.orm import Session

from nova_backtest.bars import IST
from nova_backtest.intraday.context import DayBars, History
from nova_backtest.intraday.tick_data import Bars, session_ms
from nova_backtest.tick_bars import read_tick_bars

LOOK_BACK_DAYS = 120  # calendar days searched for earlier sessions


def day_bars(rows: list[BarRow], day: date, source: str) -> DayBars:
    open_ms, _ = session_ms(day)

    def column(values: list[int]) -> np.ndarray:
        return np.array(values, dtype=np.int64)

    return DayBars(
        open_ms,
        column([int(r.ts.timestamp() * 1000) for r in rows]),
        column([r.high_paise for r in rows]),
        column([r.low_paise for r in rows]),
        column([r.close_paise for r in rows]),
        column([r.open_paise for r in rows]),
        column([r.volume for r in rows]),
        source,
    )


def from_bars(bars: Bars, day: date) -> DayBars:
    return DayBars(
        session_ms(day)[0], bars.start, bars.high, bars.low, bars.close, bars.open, bars.volume
    )


class Warmup:
    def __init__(
        self, db: Session, archive_root: Path, first: date, last: date, sessions: int
    ) -> None:
        self.db, self.archive_root = db, archive_root
        self.first, self.last = first, last
        self.needed = max(sessions, 3)
        self._days: dict[str, tuple[set[date], list[date]]] = {}
        self._cache: dict[str, dict[date, DayBars]] = {}

    def _calendar(self, symbol: str) -> tuple[set[date], list[date]]:
        """(recorded days, every earlier trading day) of a stock around the run's period."""
        if symbol not in self._days:
            since = self.first - timedelta(days=LOOK_BACK_DAYS)
            recorded = set(
                self.db.scalars(
                    select(TickDay.day).where(
                        TickDay.exchange == "NSE",
                        TickDay.symbol == symbol,
                        TickDay.day >= since,
                        TickDay.day <= self.last,
                    )
                )
            )
            candles = set(
                self.db.scalars(
                    select(CandleDay.day).where(
                        CandleDay.exchange == "NSE",
                        CandleDay.symbol == symbol,
                        CandleDay.timeframe == "1m",
                        CandleDay.day >= since,
                        CandleDay.day <= self.last,
                    )
                )
            )
            self._days[symbol] = (recorded, sorted(recorded | candles))
        return self._days[symbol]

    def remember(self, symbol: str, day: date, bars: Bars) -> None:
        """A replayed day's own 1m bars (recorded) for the days after it."""
        self._cache.setdefault(symbol, {})[day] = from_bars(bars, day)

    def _load(self, symbol: str, day: date, recorded: bool) -> DayBars:
        cache = self._cache.setdefault(symbol, {})
        if day not in cache:
            if recorded:
                rows = read_tick_bars(self.db, self.archive_root, "NSE", symbol, "1m", day)
                cache[day] = day_bars(rows, day, "recorded")
            if not recorded or not len(cache[day]):
                start = datetime.combine(day, time(0, 0), IST).astimezone(UTC)
                rows = read_bars(self.db, "NSE", symbol, "1m", start, start + timedelta(days=1))
                cache[day] = day_bars(rows, day, "history")
        return cache[day]

    def history(self, symbol: str, day: date) -> History:
        """The stock's last `needed` sessions before `day`, oldest first (empty ones left out)."""
        recorded, days = self._calendar(symbol)
        earlier = [d for d in days if d < day][-self.needed :]
        sessions = [self._load(symbol, d, d in recorded) for d in earlier]
        keep = set(earlier)
        cache = self._cache.get(symbol, {})
        for old in [d for d in cache if d < day and d not in keep]:
            del cache[old]  # memory stays at a few sessions per stock
        return History([s for s in sessions if len(s)])
