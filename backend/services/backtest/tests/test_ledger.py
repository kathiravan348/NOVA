"""Hand-worked cash movements, exact averaging costs and same-time exits (NOVA-174)."""

from datetime import UTC, date, datetime

from nova_backtest.ledger import build, filter_days
from nova_contracts import Charges, EquityPoint, Trade
from nova_testing.parity import Parity


def _trade(
    symbol: str, entry: str, exit_: str, qty: int, price: int, sold: int, gross: int, fee: int
) -> Trade:
    return Trade(
        id=f"trd_{symbol}",
        run_id="run_1",
        symbol=symbol,
        exchange="NSE",
        segment="equity_delivery",
        side="buy",
        qty=qty,
        entry_at=datetime.fromisoformat(entry).replace(tzinfo=UTC),
        entry_price_paise=price,
        exit_at=datetime.fromisoformat(exit_).replace(tzinfo=UTC),
        exit_price_paise=sold,
        gross_pnl_paise=gross,
        net_pnl_paise=gross - fee,
        charges=Charges(
            brokerage_paise=fee,
            stt_paise=0,
            exchange_txn_paise=0,
            sebi_fee_paise=0,
            stamp_duty_paise=0,
            gst_paise=0,
            dp_paise=0,
            total_paise=fee,
        ),
    )


def test_three_trades_cash_exact_cost_equity_and_ist_dates(parity: Parity) -> None:
    trades = [
        _trade("A", "2024-12-31T22:00", "2025-01-02T05:00", 2, 1000, 1200, 400, 10),
        _trade("B", "2025-01-02T04:00", "2025-01-04T05:00", 1, 3000, 2900, -100, 20),
        # Rounded average is 1001, but total cost is 2001, not 2002.
        _trade("C", "2025-01-03T04:00", "2025-01-03T05:00", 2, 1001, 1100, 199, 5),
    ]
    equity = [
        EquityPoint(date=date(2025, 1, day), equity_paise=value, benchmark_paise=None)
        for day, value in [(1, 10400), (2, 10390), (3, 10484), (4, 10464), (5, 10464)]
    ]
    ledger = build(trades, equity, 10000)
    events = [event for day in ledger.events.values() for event in day]
    assert [event.cash_after_paise for event in events] == [8000, 5000, 7390, 5389, 7584, 10464]
    assert ledger.days[0].date == date(2025, 1, 1)
    assert [day.open_positions for day in ledger.days] == [1, 1, 1, 0, 0]
    assert ledger.days[2].bought_paise == 2001
    assert sum(day.net_pnl_paise for day in ledger.days) == 464
    final = ledger.days[-1]
    assert final.cash_paise == 10464 and final.holdings_paise == 0
    assert final.cash_paise + final.holdings_paise == equity[-1].equity_paise
    for day in ledger.days:
        parity.assert_valid(day.model_dump(mode="json"), "LedgerDay")
    for event in events:
        parity.assert_valid(event.model_dump(mode="json"), "LedgerEvent")
    assert len(filter_days(ledger, None, None, None, False)) == 4
    assert len(filter_days(ledger, None, None, None, True)) == 5
    only_b = filter_days(ledger, None, None, "B", False)
    assert [day.date.day for day in only_b] == [2, 4]
    assert only_b[0].sold_paise == 0 and only_b[0].cash_paise == 7390


def test_pending_sell_precedes_buy_and_entry_bar_exit_follows_buy() -> None:
    trades = [
        _trade("A", "2025-01-01T04:00", "2025-01-02T04:00", 1, 1000, 1100, 100, 0),
        _trade("B", "2025-01-02T04:00", "2025-01-02T04:00", 1, 1100, 1200, 100, 0),
    ]
    events = build(trades, [], 1000).events[date(2025, 1, 2)]
    assert [(event.symbol, event.side, event.cash_after_paise) for event in events] == [
        ("A", "sell", 1100),
        ("B", "buy", 0),
        ("B", "sell", 1200),
    ]
