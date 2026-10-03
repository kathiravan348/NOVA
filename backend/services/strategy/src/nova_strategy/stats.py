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
           max(res.cagr_percent) AS best_cagr,
           min(res.cagr_percent) AS worst_cagr,
           min(res.win_rate_percent) AS win_rate_min,
           max(res.win_rate_percent) AS win_rate_max,
           min(res.max_drawdown_percent) AS worst_drawdown,
           (array_agg(res.run_id ORDER BY res.net_pnl_paise DESC, res.run_id)
               FILTER (WHERE res.run_id IS NOT NULL))[1] AS best_run_id,
           max(res.net_pnl_paise) AS best_net_pnl
    FROM strategies s
    LEFT JOIN backtest_runs r ON r.strategy_id = s.id
        AND (CAST(:source AS text) IS NULL OR r.data_source = :source)
    LEFT JOIN backtest_results res ON res.run_id = r.id AND r.status = 'completed'
    GROUP BY s.id, s.created_at
    ORDER BY s.created_at, s.id
    """
)


# D60: per strategy version, its completed runs and the best return (ties: lowest run id).
_BY_VERSION = text(
    """
    SELECT v.strategy_id, v.version,
           count(res.run_id) AS runs_completed,
           max(res.return_percent) AS best_return,
           (array_agg(res.run_id ORDER BY res.return_percent DESC, res.run_id)
               FILTER (WHERE res.run_id IS NOT NULL))[1] AS best_run_id
    FROM strategy_versions v
    LEFT JOIN backtest_runs r
        ON r.strategy_id = v.strategy_id AND r.strategy_version = v.version
        AND r.status = 'completed'
        AND (CAST(:source AS text) IS NULL OR r.data_source = :source)
    LEFT JOIN backtest_results res ON res.run_id = r.id
    GROUP BY v.strategy_id, v.version
    ORDER BY v.strategy_id, v.version
    """
)


def _number(value: Any) -> float | None:
    """Any: numeric columns arrive as Decimal or None."""
    return None if value is None else float(value)


def strategy_stats(db: Session, data_source: str | None = None) -> list[StrategyStats]:
    """Counts and bests from every run, or from one data source's runs only (D82 (10))."""
    params = {"source": data_source}
    by_version: dict[str, list[dict[str, Any]]] = {}
    for row in db.execute(_BY_VERSION, params):
        by_version.setdefault(row.strategy_id, []).append(
            {
                "version": row.version,
                "runs_completed": row.runs_completed,
                "best_return_percent": _number(row.best_return),
                "best_run_id": row.best_run_id,
            }
        )
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
                "best_cagr_percent": _number(row.best_cagr),
                "worst_cagr_percent": _number(row.worst_cagr),
                "win_rate_min_percent": _number(row.win_rate_min),
                "win_rate_max_percent": _number(row.win_rate_max),
                "worst_drawdown_percent": _number(row.worst_drawdown),
                "best_net_pnl": (
                    {"run_id": row.best_run_id, "net_pnl_paise": row.best_net_pnl}
                    if row.best_run_id is not None
                    else None
                ),
                "by_version": by_version.get(row.strategy_id, []),
            }
        )
        for row in db.execute(_STATS, params)
    ]
