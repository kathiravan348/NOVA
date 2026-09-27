"""Year-by-year table (D62 (6)): 12-month blocks from the run's start date.

The last block may be short; each is clipped to the run's end. A block starts at the previous
block's end equity (the first at the initial capital) and ends at its last equity point, so the
profits add up to the run's net P&L. The drawdown's peak starts at the block's start equity.
"""

from datetime import date, timedelta
from typing import Any

from nova_backtest.metrics import max_drawdown_percent


def _add_years(day: date, years: int) -> date:
    try:
        return day.replace(year=day.year + years)
    except ValueError:  # 29 Feb → 28 Feb
        return day.replace(year=day.year + years, day=28)


def blocks(first: date, last: date) -> list[tuple[date, date]]:
    out: list[tuple[date, date]] = []
    k = 0
    while (start := _add_years(first, k)) <= last:
        out.append((start, min(_add_years(first, k + 1) - timedelta(days=1), last)))
        k += 1
    return out


def _percent(start: int, end: int) -> float:
    return round((end / start - 1) * 100, 4) if start > 0 else 0.0


def year_rows(
    equity: list[tuple[date, int]],
    benchmark: list[int | None],
    initial: int,
    first: date,
    last: date,
) -> list[dict[str, Any]]:
    """Any: JSON-ready rows for `YearRow` (snake_case; the contract adds camelCase)."""
    if not equity:
        return []
    rows: list[dict[str, Any]] = []
    start, bench_start = initial, initial
    for number, (block_start, block_end) in enumerate(blocks(first, last), start=1):
        inside = [k for k, (day, _) in enumerate(equity) if block_start <= day <= block_end]
        values = [equity[k][1] for k in inside]
        end = values[-1] if values else start
        marks = [b for k in inside if (b := benchmark[k]) is not None]
        bench_end = marks[-1] if marks else None
        rows.append(
            {
                "from_": block_start,
                "to": block_end,
                "year": number,
                "return_percent": _percent(start, end),
                "profit_paise": end - start,
                "max_drawdown_percent": round(max_drawdown_percent([start, *values]), 4),
                "benchmark_percent": None
                if bench_end is None
                else _percent(bench_start, bench_end),
            }
        )
        start = end
        if bench_end is not None:
            bench_start = bench_end
    return rows
