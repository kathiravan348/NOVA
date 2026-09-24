"""Backtest summary per strategy (D26), computed in one SQL query; screens never aggregate."""

from typing import Any

from nova_contracts import StrategyStats
from sqlalchemy import text
from sqlalchemy.orm import Session

# Result fields come from completed runs with a results row (the engine writes both together).
_STATS = text(
    """
    SELECT s.id AS strategy_id,
           count(r.id) AS runs_total,
           count(r.id) FILTER (WHERE r.status = 'completed') AS runs_completed,
           count(r.id) FILTER (WHERE r.status = 'failed') AS runs_failed,
           count(r.id) FILTER (WHERE r.status IN ('queued', 'running')) AS runs_in_progress,
           max(r.created_at) AS last_run_at,
           max(res.return_percent) AS best_return,
           min(res.return_percent) AS worst_return,
           min(res.win_rate_percent) AS win_rate_min,
           max(res.win_rate_percent) AS win_rate_max,
           min(res.max_drawdown_percent) AS worst_drawdown,
           (array_agg(res.run_id ORDER BY res.net_pnl_paise DESC, res.run_id)
               FILTER (WHERE res.run_id IS NOT NULL))[1] AS best_run_id,
           max(res.net_pnl_paise) AS best_net_pnl
    FROM strategies s
    LEFT JOIN backtest_runs r ON r.strategy_id = s.id
    LEFT JOIN backtest_results res ON res.run_id = r.id AND r.status = 'completed'
    GROUP BY s.id, s.created_at
    ORDER BY s.created_at, s.id
    """
)


def _number(value: Any) -> float | None:
    """Any: numeric columns arrive as Decimal or None."""
    return None if value is None else float(value)


def strategy_stats(db: Session) -> list[StrategyStats]:
    return [
        StrategyStats.model_validate(
            {
                "strategy_id": row.strategy_id,
                "runs_total": row.runs_total,
                "runs_completed": row.runs_completed,
                "runs_failed": row.runs_failed,
                "runs_in_progress": row.runs_in_progress,
                "last_run_at": row.last_run_at,
                "best_return_percent": _number(row.best_return),
                "worst_return_percent": _number(row.worst_return),
                "win_rate_min_percent": _number(row.win_rate_min),
                "win_rate_max_percent": _number(row.win_rate_max),
                "worst_drawdown_percent": _number(row.worst_drawdown),
                "best_net_pnl": (
                    {"run_id": row.best_run_id, "net_pnl_paise": row.best_net_pnl}
                    if row.best_run_id is not None
                    else None
                ),
            }
        )
        for row in db.execute(_STATS)
    ]
