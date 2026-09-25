"""Backtest engine (D45, D46, D47): visual and Python strategies, equity delivery and intraday."""

from datetime import UTC, date, datetime, time, timedelta
from decimal import Decimal

from nova_contracts import BacktestResult as ResultContract
from nova_contracts import Charges, StrategySpec
from nova_contracts.strategy import StrategySpecPython, StrategySpecVisual
from nova_db import new_id
from nova_db.models import BacktestResult, BacktestRun, Candle, Instrument, StrategyVersion, Trade
from nova_ledger import ChargeRates, rates_for, trade_charges
from pydantic import TypeAdapter, ValidationError
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from nova_backtest.bars import IST, Bar
from nova_backtest.engine import EngineError
from nova_backtest.metrics import summarize
from nova_backtest.rules import RuleSignals
from nova_backtest.sandbox import PythonSignals, run_python
from nova_backtest.simulate import Signals, simulate

SPEC = TypeAdapter[StrategySpec](StrategySpec)
WARM_UP_DAYS = {"1d": 400}
# Zerodha squares off MIS equity positions from 15:20 IST (D46).
SQUARE_OFF = time(15, 20)
INTRADAY_WARM_UP_DAYS = 30


def _spec(db: Session, run: BacktestRun) -> StrategySpecVisual | StrategySpecPython:
    version = db.get(StrategyVersion, (run.strategy_id, run.strategy_version))
    if version is None:
        raise EngineError("The strategy version of this run no longer exists")
    try:
        spec = SPEC.validate_python(version.spec)
    except ValidationError as exc:
        raise EngineError("The stored strategy spec is not valid") from exc
    if spec.segment not in ("equity_delivery", "equity_intraday"):
        raise EngineError(f"{spec.segment} backtests are not supported yet")
    if spec.segment == "equity_intraday" and spec.timeframe == "1d":
        raise EngineError("Intraday strategies need an intraday timeframe")
    return spec


def _symbols(db: Session, run: BacktestRun) -> list[str]:
    universe = run.universe
    if universe["type"] == "symbols":
        return list(universe["symbols"])
    rows = db.scalars(
        select(Instrument.symbol)
        .where(Instrument.exchange == "NSE", Instrument.indices.any(universe["index"]))
        .order_by(Instrument.symbol)
    ).all()
    if not rows:
        raise EngineError(f"No instruments are in {universe['index']} (run sync-instruments)")
    return list(rows)


def _bars(db: Session, symbol: str, timeframe: str, start: datetime, end: datetime) -> list[Bar]:
    rows = db.scalars(
        select(Candle)
        .where(
            Candle.exchange == "NSE",
            Candle.symbol == symbol,
            Candle.timeframe == timeframe,
            Candle.ts >= start,
            Candle.ts < end,
        )
        .order_by(Candle.ts)
    )
    return [
        Bar(r.ts, r.open_paise, r.high_paise, r.low_paise, r.close_paise, r.volume) for r in rows
    ]


def _ist_midnight(day: date) -> datetime:
    return datetime.combine(day, time(0, 0), tzinfo=IST).astimezone(UTC)


class StrategyEngine:
    def run(self, db: Session, run_id: str) -> None:
        run = db.get(BacktestRun, run_id)
        if run is None:
            raise EngineError(f"Backtest run {run_id} not found")
        spec = _spec(db, run)
        symbols = _symbols(db, run)
        start = _ist_midnight(run.date_from)
        end = _ist_midnight(run.date_to + timedelta(days=1))
        warm_up = timedelta(days=WARM_UP_DAYS.get(spec.timeframe, INTRADAY_WARM_UP_DAYS))
        bars = {s: _bars(db, s, spec.timeframe, start - warm_up, end) for s in symbols}
        missing = [s for s, series in bars.items() if not any(b.ts >= start for b in series)]
        if missing:
            raise EngineError(
                f"No {spec.timeframe} candles in the period for {', '.join(missing)} "
                "(download them first)"
            )

        rates: dict[date, ChargeRates] = {}

        def charges(qty: int, entry: int, exit_: int, entry_at: datetime) -> Charges:
            day = entry_at.astimezone(IST).date()
            if day not in rates:
                try:
                    rates[day] = rates_for(db, spec.segment, day)
                except LookupError as exc:
                    raise EngineError(str(exc)) from exc
            return trade_charges(rates[day], "buy", qty, entry, exit_)

        signals: Signals = (
            RuleSignals(bars, spec.entry, spec.exit)
            if isinstance(spec, StrategySpecVisual)
            else PythonSignals(run_python(spec.code, bars))
        )
        result = simulate(
            bars,
            signals,
            spec.sizing,
            spec.risk,
            run.initial_capital_paise,
            start,
            charges,
            square_off=SQUARE_OFF if spec.segment == "equity_intraday" else None,
            averaging=spec.averaging,
        )
        summary = summarize(
            result.trades,
            result.equity,
            run.initial_capital_paise,
            run.date_from,
            run.date_to,
            symbols,
        )
        contract = ResultContract.model_validate(
            {
                "run_id": run.id,
                "metrics": summary.metrics,
                "equity_curve": [
                    {"date": day, "equity_paise": value, "benchmark_paise": None}
                    for day, value in result.equity
                ],
                "by_symbol": summary.by_symbol,
            }
        )
        wire = contract.model_dump(mode="json")

        db.execute(delete(Trade).where(Trade.run_id == run.id))
        db.execute(delete(BacktestResult).where(BacktestResult.run_id == run.id))
        for trade in result.trades:
            c = trade.charges
            db.add(
                Trade(
                    id=new_id("trd"),
                    run_id=run.id,
                    symbol=trade.symbol,
                    exchange="NSE",
                    segment=spec.segment,
                    side="buy",
                    qty=trade.qty,
                    entry_at=trade.entry_at,
                    entry_price_paise=trade.entry_price,
                    exit_at=trade.exit_at,
                    exit_price_paise=trade.exit_price,
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
            )
        )
        run.status = "completed"
        run.finished_at = datetime.now(UTC)
        db.commit()
