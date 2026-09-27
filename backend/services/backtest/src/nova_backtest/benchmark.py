"""Benchmark curve (D62 (2), (6)): the run's money as if it had followed the index instead.

Reads the index's own daily candles (stored with `symbol` = the index name). Each equity date
gets `initial × index close on or before that date ÷ the first close on or after the start`,
half-up paise. Without index candles every point is None and the run still completes.
"""

from bisect import bisect_right
from datetime import date, datetime
from decimal import ROUND_HALF_UP, Decimal

from nova_db.candles import read_bars
from sqlalchemy.orm import Session

from nova_backtest.bars import IST


def index_closes(db: Session, index: str, start: datetime, end: datetime) -> list[tuple[date, int]]:
    """The index's daily closes (IST date, paise) with `start <= ts < end`."""
    rows = read_bars(db, "NSE", index, "1d", start, end)
    return [(row.ts.astimezone(IST).date(), row.close_paise) for row in rows]


def benchmark_curve(
    closes: list[tuple[date, int]], dates: list[date], initial: int
) -> list[int | None]:
    """One value per equity date; None before the index's first close in the period."""
    if not closes:
        return [None] * len(dates)
    days = [day for day, _ in closes]
    base = Decimal(closes[0][1])
    curve: list[int | None] = []
    for day in dates:
        at = bisect_right(days, day)
        if at == 0:
            curve.append(None)
            continue
        value = Decimal(initial) * closes[at - 1][1] / base
        curve.append(int(value.quantize(Decimal(1), rounding=ROUND_HALF_UP)))
    return curve
