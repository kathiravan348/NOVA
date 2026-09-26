"""Database rows → wire contracts for runs, results and trades."""

from nova_contracts import BacktestResult as ResultContract
from nova_contracts import BacktestRun as RunContract
from nova_contracts import Trade as TradeContract
from nova_db.models import BacktestResult, BacktestRun, Trade


def run_contract(row: BacktestRun) -> RunContract:
    return RunContract.model_validate(
        {
            "id": row.id,
            "strategy_id": row.strategy_id,
            "strategy_version": row.strategy_version,
            "name": row.name,
            "universe": row.universe,
            "status": row.status,
            "from_": row.date_from,
            "to": row.date_to,
            "initial_capital_paise": row.initial_capital_paise,
            "benchmark": row.benchmark,
            "created_at": row.created_at,
            "started_at": row.started_at,
            "finished_at": row.finished_at,
            "error": row.error,
            "progress": None
            if row.stage is None
            else {
                "stage": row.stage,
                "percent": row.progress_percent,
                "symbols_done": row.symbols_done,
                "symbols_total": row.symbols_total,
                "bars_done": row.bars_done,
                "bars_total": row.bars_total,
                "trades_so_far": row.trades_so_far,
                "simulated_to": row.simulated_to,
            },
        }
    )


def result_contract(row: BacktestResult) -> ResultContract:
    return ResultContract.model_validate(
        {
            "run_id": row.run_id,
            "metrics": {
                "gross_pnl_paise": row.gross_pnl_paise,
                "charges_paise": row.charges_paise,
                "net_pnl_paise": row.net_pnl_paise,
                "return_percent": float(row.return_percent),
                "cagr_percent": float(row.cagr_percent),
                "max_drawdown_percent": float(row.max_drawdown_percent),
                "sharpe": float(row.sharpe),
                "win_rate_percent": float(row.win_rate_percent),
                "trade_count": row.trade_count,
                "win_count": row.win_count,
                "loss_count": row.loss_count,
            },
            "equity_curve": row.equity_curve,
            "by_symbol": row.by_symbol,
        }
    )


def trade_contract(row: Trade) -> TradeContract:
    return TradeContract.model_validate(
        {
            "id": row.id,
            "run_id": row.run_id,
            "symbol": row.symbol,
            "exchange": row.exchange,
            "segment": row.segment,
            "side": row.side,
            "qty": row.qty,
            "entry_at": row.entry_at,
            "entry_price_paise": row.entry_price_paise,
            "exit_at": row.exit_at,
            "exit_price_paise": row.exit_price_paise,
            "gross_pnl_paise": row.gross_pnl_paise,
            "charges": {
                "brokerage_paise": row.brokerage_paise,
                "stt_paise": row.stt_paise,
                "exchange_txn_paise": row.exchange_txn_paise,
                "sebi_fee_paise": row.sebi_fee_paise,
                "stamp_duty_paise": row.stamp_duty_paise,
                "gst_paise": row.gst_paise,
                "dp_paise": row.dp_paise,
                "total_paise": row.charges_total_paise,
            },
            "net_pnl_paise": row.net_pnl_paise,
        }
    )
