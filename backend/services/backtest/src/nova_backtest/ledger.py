"""Reconstruct a run's IST day ledger from trades and its end-of-day equity (D82)."""

from collections import defaultdict
from collections.abc import Sequence
from dataclasses import dataclass
from datetime import date

from nova_common import ApiException
from nova_contracts import EquityPoint, LedgerDay, LedgerEvent, Trade
from nova_db.models import BacktestResult, BacktestRun
from nova_db.models import Trade as TradeRow
from sqlalchemy import select
from sqlalchemy.orm import Session

from nova_backtest.bars import IST
from nova_backtest.convert import result_contract, trade_contract


@dataclass(frozen=True)
class Ledger:
    days: list[LedgerDay]
    events: dict[date, list[LedgerEvent]]


def _events(trades: Sequence[Trade]) -> list[LedgerEvent]:
    staged: list[tuple[int, str, LedgerEvent]] = []
    for trade in trades:
        exit_price, exit_at = trade.exit_price_paise, trade.exit_at
        cost = (
            trade.qty * trade.entry_price_paise
            if exit_price is None
            else trade.qty * exit_price - trade.gross_pnl_paise
        )
        staged.append(
            (
                1,
                trade.id,
                LedgerEvent(
                    at=trade.entry_at,
                    symbol=trade.symbol,
                    side="buy",
                    qty=trade.qty,
                    price_paise=trade.entry_price_paise,
                    amount_paise=cost,
                    charges_paise=0,
                    net_pnl_paise=None,
                    reason=None,
                    cash_after_paise=0,
                ),
            )
        )
        if exit_price is not None and exit_at is not None:
            # Pending sells free cash before buys. An entry-bar risk exit follows its buy.
            priority = 0 if exit_at > trade.entry_at else 2
            staged.append(
                (
                    priority,
                    trade.id,
                    LedgerEvent(
                        at=exit_at,
                        symbol=trade.symbol,
                        side="sell",
                        qty=trade.qty,
                        price_paise=exit_price,
                        amount_paise=trade.qty * exit_price,
                        charges_paise=trade.charges.total_paise,
                        net_pnl_paise=trade.net_pnl_paise,
                        reason=trade.exit_reason,
                        cash_after_paise=0,
                    ),
                )
            )
    staged.sort(key=lambda item: (item[2].at, item[0], item[2].symbol, item[1]))
    return [event for _, _, event in staged]


def build(
    trades: Sequence[Trade], equity_curve: Sequence[EquityPoint], initial_cash: int
) -> Ledger:
    grouped: dict[date, list[LedgerEvent]] = defaultdict(list)
    cash = initial_cash
    for event in _events(trades):
        cash += (
            -event.amount_paise if event.side == "buy" else event.amount_paise - event.charges_paise
        )
        grouped[event.at.astimezone(IST).date()].append(
            event.model_copy(update={"cash_after_paise": cash})
        )
    equities = {point.date: point.equity_paise for point in equity_curve}
    days: list[LedgerDay] = []
    cash, equity, positions = initial_cash, initial_cash, 0
    for day in sorted(equities.keys() | grouped.keys()):
        events = grouped.get(day, [])
        buys = [event for event in events if event.side == "buy"]
        sells = [event for event in events if event.side == "sell"]
        positions += len(buys) - len(sells)
        if events:
            cash = events[-1].cash_after_paise
        equity = equities.get(day, equity)
        days.append(
            LedgerDay(
                date=day,
                buys=len(buys),
                sells=len(sells),
                bought_paise=sum(event.amount_paise for event in buys),
                sold_paise=sum(event.amount_paise for event in sells),
                charges_paise=sum(event.charges_paise for event in sells),
                net_pnl_paise=sum(event.net_pnl_paise or 0 for event in sells),
                cash_paise=cash,
                holdings_paise=equity - cash,
                equity_paise=equity,
                open_positions=positions,
            )
        )
    return Ledger(days, dict(grouped))


def load(db: Session, run_id: str) -> Ledger:
    run = db.get(BacktestRun, run_id)
    if run is None:
        raise ApiException(404, "not_found", f"Backtest run {run_id} not found")
    if not run.report_kept:
        raise ApiException(400, "invalid_request", "Only the newest version keeps the full report")
    if run.status != "completed":
        raise ApiException(400, "invalid_request", "The backtest has not completed")
    result = db.get(BacktestResult, run_id)
    if result is None:
        raise ApiException(404, "not_found", f"Backtest result for run {run_id} not found")
    rows = db.scalars(select(TradeRow).where(TradeRow.run_id == run_id)).all()
    return build(
        [trade_contract(row) for row in rows],
        result_contract(result).equity_curve,
        run.initial_capital_paise,
    )


def filter_days(
    ledger: Ledger,
    from_: date | None,
    to: date | None,
    symbol: str | None,
    all_days: bool,
) -> list[LedgerDay]:
    if from_ is not None and to is not None and from_ > to:
        raise ApiException(400, "invalid_request", "from must be on or before to")
    days: list[LedgerDay] = []
    for day in ledger.days:
        if (from_ is not None and day.date < from_) or (to is not None and day.date > to):
            continue
        events = ledger.events.get(day.date, [])
        if symbol is not None:
            events = [event for event in events if event.symbol == symbol]
        if not all_days and not events:
            continue
        if symbol is None:
            days.append(day)
            continue
        buys = [event for event in events if event.side == "buy"]
        sells = [event for event in events if event.side == "sell"]
        days.append(
            day.model_copy(
                update={
                    "buys": len(buys),
                    "sells": len(sells),
                    "bought_paise": sum(event.amount_paise for event in buys),
                    "sold_paise": sum(event.amount_paise for event in sells),
                    "charges_paise": sum(event.charges_paise for event in sells),
                    "net_pnl_paise": sum(event.net_pnl_paise or 0 for event in sells),
                }
            )
        )
    return days
