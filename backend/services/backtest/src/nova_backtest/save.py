"""A finished simulation → metrics, benchmark, tax, years, trades and result rows (D45, D62)."""

from collections.abc import Callable
from datetime import UTC, date, datetime
from decimal import Decimal

from nova_contracts import BacktestResult as ResultContract
from nova_db import new_id
from nova_db.models import BacktestResult, BacktestRun, Trade
from sqlalchemy import delete
from sqlalchemy.orm import Session

from nova_backtest.benchmark import benchmark_curve, index_closes
from nova_backtest.metrics import summarize
from nova_backtest.progress import ProgressSink
from nova_backtest.simulate import Simulation
from nova_backtest.tax import estimate_tax
from nova_backtest.versions import trim_older_versions
from nova_backtest.years import year_rows


def _decimal(value: float | None) -> Decimal | None:
    return None if value is None else Decimal(str(value))


def save_result(
    db: Session,
    run: BacktestRun,
    segment: str,
    symbols: list[str],
    skipped: list[str],
    result: Simulation,
    period: tuple[datetime, datetime],
    progress: ProgressSink,
    recorded_days: tuple[int, list[date]] | None = None,
    with_trades: Callable[[list[str]], None] | None = None,
) -> None:
    """Writes the run's trades and result and marks it completed, in the run's transaction.

    `with_trades` gets the new trade ids in `result.trades` order before the commit (the intraday
    simulator adds its own rows there, D84). The run row changes only after the last progress
    write: `Progress` updates that row from its own session, and an earlier change (autoflushed by
    any query) makes it wait for ever (NOVA-137).
    """
    initial = run.initial_capital_paise
    dates = [day for day, _ in result.equity]
    closes = index_closes(db, run.benchmark, *period) if run.benchmark else []
    bench = benchmark_curve(closes, dates, initial)
    tax = estimate_tax(result.trades, segment)
    summary = summarize(
        result.trades,
        result.equity,
        initial,
        run.date_from,
        run.date_to,
        symbols,
        bench,
        None if tax is None else tax.tax_paise,
    )
    contract = ResultContract.model_validate(
        {
            "run_id": run.id,
            "metrics": summary.metrics,
            "equity_curve": [
                {"date": day, "equity_paise": value, "benchmark_paise": b}
                for (day, value), b in zip(result.equity, bench, strict=True)
            ],
            "by_symbol": summary.by_symbol,
            "years": year_rows(result.equity, bench, initial, run.date_from, run.date_to),
        }
    )
    wire = contract.model_dump(mode="json")

    progress.stage("saving", len(result.trades))
    db.execute(delete(Trade).where(Trade.run_id == run.id))
    db.execute(delete(BacktestResult).where(BacktestResult.run_id == run.id))
    trade_ids: list[str] = []
    for trade in result.trades:
        c = trade.charges
        trade_ids.append(new_id("trd"))
        db.add(
            Trade(
                id=trade_ids[-1],
                run_id=run.id,
                symbol=trade.symbol,
                exchange="NSE",
                segment=segment,
                side="buy",
                qty=trade.qty,
                entry_at=trade.entry_at,
                entry_price_paise=trade.entry_price,
                exit_at=trade.exit_at,
                exit_price_paise=trade.exit_price,
                exit_reason=trade.exit_reason,
                gross_pnl_paise=trade.gross,
                brokerage_paise=c.brokerage_paise,
                stt_paise=c.stt_paise,
                exchange_txn_paise=c.exchange_txn_paise,
                sebi_fee_paise=c.sebi_fee_paise,
                stamp_duty_paise=c.stamp_duty_paise,
                gst_paise=c.gst_paise,
                dp_paise=c.dp_paise,
                charges_total_paise=c.total_paise,
                net_pnl_paise=trade.net,
            )
        )
    m = summary.metrics
    db.add(
        BacktestResult(
            run_id=run.id,
            gross_pnl_paise=m["gross_pnl_paise"],
            charges_paise=m["charges_paise"],
            net_pnl_paise=m["net_pnl_paise"],
            return_percent=Decimal(str(m["return_percent"])),
            cagr_percent=Decimal(str(m["cagr_percent"])),
            max_drawdown_percent=Decimal(str(m["max_drawdown_percent"])),
            sharpe=Decimal(str(m["sharpe"])),
            win_rate_percent=Decimal(str(m["win_rate_percent"])),
            trade_count=m["trade_count"],
            win_count=m["win_count"],
            loss_count=m["loss_count"],
            equity_curve=wire["equityCurve"],
            by_symbol=wire["bySymbol"],
            benchmark_return_percent=_decimal(m["benchmark_return_percent"]),
            benchmark_cagr_percent=_decimal(m["benchmark_cagr_percent"]),
            exposure_percent=_decimal(m["exposure_percent"]),
            avg_hold_days=_decimal(m["avg_hold_days"]),
            profit_factor=_decimal(m["profit_factor"]),
            calmar=_decimal(m["calmar"]),
            after_tax_cagr_percent=_decimal(m["after_tax_cagr_percent"]),
            estimated_tax_paise=m["estimated_tax_paise"],
            after_tax_net_pnl_paise=m["after_tax_net_pnl_paise"],
            years=wire["years"],
            spread_cost_paise=result.spread_cost,
        )
    )
    run.skipped_symbols = skipped
    if recorded_days is not None:  # D82: used sessions and feed-gap days of a recorded run
        run.recorded_days_used, run.recorded_days_skipped = recorded_days
    run.status = "completed"
    run.finished_at = datetime.now(UTC)
    run.stage = "done"
    run.progress_percent = 100
    run.trades_so_far = len(result.trades)
    trim_older_versions(db, run)  # D60: older versions keep only their metrics
    if with_trades is not None:
        db.flush()  # trades first: rows that point at them follow
        with_trades(trade_ids)
    db.commit()
