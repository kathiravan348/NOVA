"""Run metrics and per-symbol rows from closed trades and the daily equity curve (D45)."""

import math
from dataclasses import dataclass
from datetime import date
from typing import Any

from nova_backtest.simulate import ClosedTrade

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


def summarize(
    trades: list[ClosedTrade],
    equity: list[tuple[date, int]],
    initial: int,
    first: date,
    last: date,
    symbols: list[str],
) -> Summary:
    gross = sum(t.gross for t in trades)
    charges = sum(t.charges.total_paise for t in trades)
    net = gross - charges
    wins = sum(1 for t in trades if t.net > 0)
    losses = sum(1 for t in trades if t.net < 0)
    curve = [initial] + [value for _, value in equity]
    metrics = {
        "gross_pnl_paise": gross,
        "charges_paise": charges,
        "net_pnl_paise": net,
        "return_percent": round(net * 100 / initial, 4),
        "cagr_percent": round(cagr_percent(initial, initial + net, first, last), 4),
        "max_drawdown_percent": round(max_drawdown_percent(curve), 4),
        "sharpe": round(sharpe(curve), 4),
        "win_rate_percent": _win_rate(wins, len(trades)),
        "trade_count": len(trades),
        "win_count": wins,
        "loss_count": losses,
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
