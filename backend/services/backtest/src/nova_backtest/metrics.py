"""Run metrics and per-symbol rows from closed trades and the daily equity curve (D45, D62)."""

import math
from bisect import bisect_left, bisect_right
from collections.abc import Sequence
from dataclasses import dataclass
from datetime import date
from typing import Any

from nova_backtest.bars import IST
from nova_backtest.book import ClosedTrade

TRADING_DAYS = 252
CAGR_MIN, CAGR_MAX = -100.0, 1_000_000.0


@dataclass(frozen=True)
class Summary:
    """Any: JSON-ready dicts for the contract (camelCase keys are added by the contract model)."""

    metrics: dict[str, Any]
    by_symbol: list[dict[str, Any]]


def max_drawdown_percent(curve: list[int]) -> float:
    peak, worst = 0, 0.0
    for value in curve:
        peak = max(peak, value)
        if peak > 0:
            worst = min(worst, (value - peak) * 100 / peak)
    return worst


def sharpe(curve: list[int]) -> float:
    returns = [curve[i] / curve[i - 1] - 1 for i in range(1, len(curve)) if curve[i - 1] > 0]
    if len(returns) < 2:
        return 0.0
    mean = sum(returns) / len(returns)
    spread = math.sqrt(sum((r - mean) ** 2 for r in returns) / (len(returns) - 1))
    return 0.0 if spread == 0 else mean / spread * math.sqrt(TRADING_DAYS)


def cagr_percent(initial: int, final: int, first: date, last: date) -> float:
    years = ((last - first).days + 1) / 365.25
    if final <= 0:
        return CAGR_MIN
    try:
        value = (math.pow(final / initial, 1 / years) - 1) * 100
    except OverflowError:
        return CAGR_MAX
    return max(CAGR_MIN, min(CAGR_MAX, value))


def _win_rate(wins: int, count: int) -> float:
    return round(wins * 100 / count, 2) if count else 0.0


def exposure_percent(trades: Sequence[ClosedTrade], dates: list[date]) -> float | None:
    """% of equity dates with a trade open, each trade from its entry date to its exit date."""
    if not dates:
        return None
    covered = [False] * len(dates)
    for trade in trades:
        first = bisect_left(dates, trade.entry_at.astimezone(IST).date())
        last = bisect_right(dates, trade.exit_at.astimezone(IST).date())
        for k in range(first, last):
            covered[k] = True
    return round(sum(covered) * 100 / len(dates), 4)


def avg_hold_days(trades: Sequence[ClosedTrade]) -> float | None:
    if not trades:
        return None
    seconds = sum((t.exit_at - t.entry_at).total_seconds() for t in trades)
    return round(seconds / 86_400 / len(trades), 2)


def profit_factor(trades: Sequence[ClosedTrade]) -> float | None:
    """Net won ÷ net lost; None without a losing trade."""
    lost = -sum(t.net for t in trades if t.net < 0)
    won = sum(t.net for t in trades if t.net > 0)
    return round(won / lost, 4) if lost else None


def calmar(cagr: float, drawdown: float) -> float | None:
    return round(cagr / abs(drawdown), 4) if drawdown else None


def benchmark_metrics(
    benchmark: Sequence[int | None], initial: int, first: date, last: date
) -> tuple[float | None, float | None]:
    """Return % and CAGR % of the benchmark curve's last value; None without one."""
    values = [b for b in benchmark if b is not None]
    if not values:
        return None, None
    final = values[-1]
    return (
        round((final / initial - 1) * 100, 4),
        round(cagr_percent(initial, final, first, last), 4),
    )


def summarize(
    trades: list[ClosedTrade],
    equity: list[tuple[date, int]],
    initial: int,
    first: date,
    last: date,
    symbols: list[str],
    benchmark: Sequence[int | None] = (),
    tax_paise: int | None = None,
) -> Summary:
    """`tax_paise`: the estimated tax of a delivery run (None: no estimate, e.g. intraday)."""
    gross = sum(t.gross for t in trades)
    charges = sum(t.charges.total_paise for t in trades)
    net = gross - charges
    wins = sum(1 for t in trades if t.net > 0)
    losses = sum(1 for t in trades if t.net < 0)
    curve = [initial] + [value for _, value in equity]
    cagr = round(cagr_percent(initial, initial + net, first, last), 4)
    drawdown = round(max_drawdown_percent(curve), 4)
    bench_return, bench_cagr = benchmark_metrics(benchmark, initial, first, last)
    after_tax = None if tax_paise is None else net - tax_paise
    metrics = {
        "gross_pnl_paise": gross,
        "charges_paise": charges,
        "net_pnl_paise": net,
        "return_percent": round(net * 100 / initial, 4),
        "cagr_percent": cagr,
        "max_drawdown_percent": drawdown,
        "sharpe": round(sharpe(curve), 4),
        "win_rate_percent": _win_rate(wins, len(trades)),
        "trade_count": len(trades),
        "win_count": wins,
        "loss_count": losses,
        "benchmark_return_percent": bench_return,
        "benchmark_cagr_percent": bench_cagr,
        "exposure_percent": exposure_percent(trades, [day for day, _ in equity]),
        "avg_hold_days": avg_hold_days(trades),
        "profit_factor": profit_factor(trades),
        "calmar": calmar(cagr, drawdown),
        "estimated_tax_paise": tax_paise,
        "after_tax_net_pnl_paise": after_tax,
        # The tax is taken at the end of the run: CAGR of initial + the after-tax net P&L.
        "after_tax_cagr_percent": None
        if after_tax is None
        else round(cagr_percent(initial, initial + after_tax, first, last), 4),
    }
    by_symbol = []
    for symbol in symbols:
        own = [t for t in trades if t.symbol == symbol]
        own_wins = sum(1 for t in own if t.net > 0)
        by_symbol.append(
            {
                "symbol": symbol,
                "trade_count": len(own),
                "win_count": own_wins,
                "loss_count": sum(1 for t in own if t.net < 0),
                "win_rate_percent": _win_rate(own_wins, len(own)),
                "net_pnl_paise": sum(t.net for t in own),
            }
        )
    return Summary(metrics=metrics, by_symbol=by_symbol)
