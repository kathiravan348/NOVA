from datetime import UTC, date, datetime

import pytest
from nova_backtest.metrics import CAGR_MAX, cagr_percent, max_drawdown_percent, sharpe, summarize
from nova_backtest.simulate import ClosedTrade
from nova_contracts import Charges

T = datetime(2026, 9, 1, tzinfo=UTC)


def _trade(symbol: str, entry: int, exit_: int, fee: int = 0) -> ClosedTrade:
    charges = Charges(
        brokerage_paise=fee,
        stt_paise=0,
        exchange_txn_paise=0,
        sebi_fee_paise=0,
        stamp_duty_paise=0,
        gst_paise=0,
        dp_paise=0,
        total_paise=fee,
    )
    return ClosedTrade(symbol, 1, T, entry, T, exit_, charges)


def test_drawdown_is_the_worst_fall_from_a_peak() -> None:
    assert max_drawdown_percent([100, 120, 90, 130]) == -25.0
    assert max_drawdown_percent([100, 110, 120]) == 0.0


def test_sharpe_is_zero_without_variation() -> None:
    assert sharpe([100, 101]) == 0.0
    assert sharpe([100, 100, 100]) == 0.0
    assert sharpe([100, 102, 101, 104]) > 0


def test_cagr() -> None:
    year = (date(2025, 1, 1), date(2025, 12, 31))

    assert cagr_percent(100, 200, *year) == pytest.approx(100, rel=1e-3)
    assert cagr_percent(100, 0, *year) == -100
    assert cagr_percent(100, 10**9, date(2025, 1, 1), date(2025, 1, 1)) == CAGR_MAX


def test_summary_counts_and_symbol_rows() -> None:
    trades = [_trade("INFY", 100, 150, fee=10), _trade("INFY", 100, 90), _trade("TCS", 100, 100)]

    summary = summarize(
        trades,
        [(date(2025, 1, 1), 10_030)],
        10_000,
        date(2025, 1, 1),
        date(2025, 1, 1),
        ["INFY", "TCS", "WIPRO"],
    )

    m = summary.metrics
    assert (m["gross_pnl_paise"], m["charges_paise"], m["net_pnl_paise"]) == (40, 10, 30)
    assert (m["trade_count"], m["win_count"], m["loss_count"]) == (3, 1, 1)
    assert m["win_rate_percent"] == 33.33 and m["return_percent"] == 0.3
    assert [row["trade_count"] for row in summary.by_symbol] == [2, 1, 0]
    assert summary.by_symbol[0]["net_pnl_paise"] == 30
