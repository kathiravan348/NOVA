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


def _held(entry: datetime, exit_: datetime, net: int) -> ClosedTrade:
    trade = _trade("INFY", 1_000, 1_000 + net)
    return ClosedTrade(trade.symbol, 1, entry, 1_000, exit_, 1_000 + net, trade.charges)


def test_d62_metrics() -> None:
    """NOVA-116: exposure, days held, profit factor, Calmar, benchmark and after-tax numbers."""
    days = [date(2025, 1, d) for d in (1, 2, 3, 6, 7)]
    trades = [
        _held(datetime(2025, 1, 1, 4, tzinfo=UTC), datetime(2025, 1, 2, 4, tzinfo=UTC), 300),
        _held(datetime(2025, 1, 6, 4, tzinfo=UTC), datetime(2025, 1, 6, 16, tzinfo=UTC), -100),
    ]
    equity = list(zip(days, [10_000, 10_300, 10_300, 10_200, 10_200], strict=True))

    m = summarize(
        trades,
        equity,
        10_000,
        days[0],
        days[-1],
        ["INFY"],
        [None, 10_000, 10_500, 10_500, 11_000],
        50,
    ).metrics

    assert m["exposure_percent"] == 60.0  # 1, 2 and 6 Jan of five dates
    assert m["avg_hold_days"] == 0.75  # (24 h + 12 h) / 2
    assert m["profit_factor"] == 3.0
    assert m["calmar"] == round(m["cagr_percent"] / abs(m["max_drawdown_percent"]), 4)
    assert (m["benchmark_return_percent"], m["estimated_tax_paise"]) == (10.0, 50)
    assert m["after_tax_net_pnl_paise"] == 200 - 50
    assert m["after_tax_cagr_percent"] < m["cagr_percent"]


def test_d62_metrics_without_losses_benchmark_or_tax_are_null() -> None:
    m = summarize(
        [], [(date(2025, 1, 1), 10_000)], 10_000, date(2025, 1, 1), date(2025, 1, 1), []
    ).metrics

    assert m["profit_factor"] is None and m["calmar"] is None and m["avg_hold_days"] is None
    assert m["benchmark_return_percent"] is None and m["benchmark_cagr_percent"] is None
    assert m["estimated_tax_paise"] is None and m["after_tax_cagr_percent"] is None
    assert m["exposure_percent"] == 0.0
