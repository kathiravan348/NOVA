"""`GET /backtests` with results, filters and sorting on the server (D82 (6)).

One query joins each run (newest version only, D60) with its strategy version (segment and
timeframe from the spec) and its result (null until completed). A metric filter keeps completed
runs only; a metric sort puts runs without results last and pages by offset only.
"""

from dataclasses import dataclass
from datetime import datetime
from decimal import Decimal

from nova_common import ApiException
from nova_common.paging import decode_cursor, encode_cursor
from nova_contracts import BacktestListSort, BacktestRunListItem
from nova_db.models import BacktestResult, BacktestRun, StrategyVersion
from sqlalchemy import ColumnElement, Select, and_, exists, func, select, tuple_
from sqlalchemy.orm import InstrumentedAttribute, Session, aliased

from nova_backtest.convert import run_contract


@dataclass(frozen=True)
class RunFilters:
    data_source: str | None = None
    status: str | None = None
    strategy_id: str | None = None
    q: str | None = None
    segment: str | None = None
    timeframe: str | None = None
    min_return: float | None = None
    min_cagr: float | None = None
    max_drawdown: float | None = None  # positive: drawdown not worse than −N %
    min_win_rate: float | None = None
    min_trades: int | None = None
    min_profit_factor: float | None = None
    profitable: bool | None = None

    def uses_results(self) -> bool:
        return any(
            v is not None
            for v in (
                self.min_return,
                self.min_cagr,
                self.max_drawdown,
                self.min_win_rate,
                self.min_trades,
                self.min_profit_factor,
                self.profitable,
            )
        )


SEGMENT = StrategyVersion.spec["segment"].astext
TIMEFRAME = StrategyVersion.spec["timeframe"].astext
Sortable = (
    InstrumentedAttribute[int]
    | InstrumentedAttribute[Decimal]
    | InstrumentedAttribute[Decimal | None]
)
SORTS: dict[str, Sortable] = {
    "netPnl": BacktestResult.net_pnl_paise,
    "return": BacktestResult.return_percent,
    "cagr": BacktestResult.cagr_percent,
    "maxDrawdown": BacktestResult.max_drawdown_percent,
    "winRate": BacktestResult.win_rate_percent,
    "profitFactor": BacktestResult.profit_factor,
    "sharpe": BacktestResult.sharpe,
    "trades": BacktestResult.trade_count,
}


def _where(f: RunFilters) -> list[ColumnElement[bool]]:
    newer = aliased(BacktestRun)
    where: list[ColumnElement[bool]] = [
        ~exists().where(newer.root_id == BacktestRun.root_id, newer.version > BacktestRun.version)
    ]
    exact = (
        (BacktestRun.data_source, f.data_source),
        (BacktestRun.status, f.status),
        (BacktestRun.strategy_id, f.strategy_id),
        (SEGMENT, f.segment),
        (TIMEFRAME, f.timeframe),
    )
    where += [column == value for column, value in exact if value is not None]
    if f.q:
        text = f.q.replace("\\", "\\\\").replace("%", "\%").replace("_", "\_")
        where.append(BacktestRun.name.ilike(f"%{text}%", escape="\\"))
    if f.uses_results():
        where.append(BacktestRun.status == "completed")
        where.append(BacktestResult.run_id.is_not(None))
    minimums = (
        (BacktestResult.return_percent, f.min_return),
        (BacktestResult.cagr_percent, f.min_cagr),
        (BacktestResult.win_rate_percent, f.min_win_rate),
        (BacktestResult.trade_count, f.min_trades),
        (BacktestResult.profit_factor, f.min_profit_factor),
    )
    where += [column >= value for column, value in minimums if value is not None]
    if f.max_drawdown is not None:
        where.append(BacktestResult.max_drawdown_percent >= -f.max_drawdown)
    if f.profitable is True:
        where.append(BacktestResult.net_pnl_paise > 0)
    elif f.profitable is False:
        where.append(BacktestResult.net_pnl_paise <= 0)
    return where


def _base(
    where: list[ColumnElement[bool]],
) -> Select[tuple[BacktestRun, BacktestResult | None, str, str]]:
    return (
        select(BacktestRun, BacktestResult, SEGMENT, TIMEFRAME)
        .join(
            StrategyVersion,
            and_(
                StrategyVersion.strategy_id == BacktestRun.strategy_id,
                StrategyVersion.version == BacktestRun.strategy_version,
            ),
        )
        .outerjoin(BacktestResult, BacktestResult.run_id == BacktestRun.id)
        .where(*where)
    )


def list_runs(
    db: Session,
    filters: RunFilters,
    sort: BacktestListSort,
    descending: bool,
    limit: int,
    cursor: str | None,
    offset: int | None,
) -> tuple[list[BacktestRunListItem], str | None, int]:
    if offset is not None and cursor is not None:
        raise ApiException(422, "invalid_request", "Use either offset or cursor, not both")
    if cursor is not None and sort != "created":
        raise ApiException(400, "invalid_request", "A results sort pages by offset, not cursor")
    where = _where(filters)
    total = db.scalar(select(func.count()).select_from(_base(where).subquery())) or 0
    query = _base(where)
    at, row_id = BacktestRun.created_at, BacktestRun.id
    ties = (at.desc(), row_id.desc())
    if sort == "created":
        query = query.order_by(*(ties if descending else (at.asc(), row_id.asc())))
        if cursor is not None:
            at_text, id_text = decode_cursor(cursor, 2)
            key = (datetime.fromisoformat(at_text), id_text)
            query = query.where(
                tuple_(at, row_id) < key if descending else tuple_(at, row_id) > key
            )
    else:
        metric = SORTS[sort]
        direction = metric.desc() if descending else metric.asc()
        query = query.order_by(direction.nulls_last(), *ties)
    if offset is not None:
        query = query.offset(offset)
    rows = db.execute(query.limit(limit + 1)).all()
    more = len(rows) > limit
    rows = rows[:limit]
    items = [_item(run, result, segment, timeframe) for run, result, segment, timeframe in rows]
    next_cursor = None
    if more and sort == "created" and offset is None:
        last = rows[-1][0]
        next_cursor = encode_cursor([last.created_at.isoformat(), last.id])
    return items, next_cursor, total


def _item(
    run: BacktestRun, result: BacktestResult | None, segment: str, timeframe: str
) -> BacktestRunListItem:
    summary = None
    if result is not None and run.status == "completed":
        summary = {
            "net_pnl_paise": result.net_pnl_paise,
            "return_percent": float(result.return_percent),
            "cagr_percent": float(result.cagr_percent),
            "max_drawdown_percent": float(result.max_drawdown_percent),
            "win_rate_percent": float(result.win_rate_percent),
            "trade_count": result.trade_count,
            "profit_factor": None if result.profit_factor is None else float(result.profit_factor),
            "sharpe": float(result.sharpe),
            "after_tax_cagr_percent": (
                None
                if result.after_tax_cagr_percent is None
                else float(result.after_tax_cagr_percent)
            ),
            "spread_cost_paise": result.spread_cost_paise,
        }
    body = run_contract(run).model_dump()
    return BacktestRunListItem.model_validate(
        body | {"segment": segment, "timeframe": timeframe, "summary": summary}
    )
