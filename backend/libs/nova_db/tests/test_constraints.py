"""Each contract refinement is also a CHECK (D37): a valid row passes, a bad one fails."""

from collections.abc import Callable
from datetime import UTC, date, datetime, timedelta
from decimal import Decimal
from typing import Any

import pytest
from nova_db.models import (
    AuditEntry,
    BacktestResult,
    BacktestRun,
    Base,
    BrokerAccount,
    BrokerSession,
    Candle,
    DataJob,
    RateLimitRule,
    Strategy,
    StrategyVersion,
    Trade,
)
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

NOW = datetime(2026, 9, 24, 4, 30, tzinfo=UTC)
SPEC = {"mode": "python", "code": "pass"}


def _run(**over: Any) -> BacktestRun:
    fields: dict[str, Any] = {
        "id": "run_1",
        "strategy_id": "stg_1",
        "strategy_version": 1,
        "name": "Test run",
        "universe": {"type": "index", "index": "NIFTY 50"},
        "status": "completed",
        "date_from": date(2025, 1, 1),
        "date_to": date(2025, 6, 30),
        "initial_capital_paise": 50_000_000,
        "benchmark": "NIFTY 50",
    }
    return BacktestRun(**(fields | over))


def _result(**over: Any) -> BacktestResult:
    fields: dict[str, Any] = {
        "run_id": "run_1",
        "gross_pnl_paise": 1_000,
        "charges_paise": 100,
        "net_pnl_paise": 900,
        "return_percent": Decimal("1.5"),
        "cagr_percent": Decimal("3.1"),
        "max_drawdown_percent": Decimal("-2.25"),
        "sharpe": Decimal("1.2"),
        "win_rate_percent": Decimal("50"),
        "trade_count": 4,
        "win_count": 2,
        "loss_count": 2,
        "equity_curve": [],
        "by_symbol": [],
    }
    return BacktestResult(**(fields | over))


def _trade(**over: Any) -> Trade:
    charges = {
        "brokerage_paise": 40,
        "stt_paise": 25,
        "exchange_txn_paise": 5,
        "sebi_fee_paise": 1,
        "stamp_duty_paise": 3,
        "gst_paise": 8,
        "dp_paise": 0,
    }
    fields: dict[str, Any] = {
        "id": "trd_1",
        "run_id": "run_1",
        "symbol": "INFY",
        "exchange": "NSE",
        "segment": "equity_delivery",
        "side": "buy",
        "qty": 10,
        "entry_at": NOW,
        "entry_price_paise": 150_000,
        "exit_at": NOW + timedelta(days=3),
        "exit_price_paise": 151_000,
        "gross_pnl_paise": 10_000,
        "charges_total_paise": 82,
        "net_pnl_paise": 9_918,
        **charges,
    }
    return Trade(**(fields | over))


def _rule(**over: Any) -> RateLimitRule:
    fields: dict[str, Any] = {
        "account_id": "brk_1",
        "endpoint": "orders",
        "rate_window": "day",
        "broker_limit": 5_000,
        "nova_limit": 4_500,
    }
    return RateLimitRule(**(fields | over))


def _broker_session(**over: Any) -> BrokerSession:
    fields: dict[str, Any] = {
        "account_id": "brk_1",
        "access_token_encrypted": b"sealed",
        "logged_in_at": NOW,
        "expires_at": NOW + timedelta(hours=20),
    }
    return BrokerSession(**(fields | over))


def _job(**over: Any) -> DataJob:
    fields: dict[str, Any] = {
        "id": "job_1",
        "type": "historical_download",
        "status": "completed",
        "exchange": "NSE",
        "segment": "equity_delivery",
        "symbols": ["INFY"],
        "timeframe": "1d",
        "date_from": date(2024, 1, 1),
        "date_to": date(2024, 12, 31),
        "progress_percent": Decimal("100"),
        "rows_written": 250,
        "started_at": NOW,
        "finished_at": NOW,
    }
    return DataJob(**(fields | over))


def _audit(**over: Any) -> AuditEntry:
    fields: dict[str, Any] = {
        "id": "aud_1",
        "actor_name": "System",
        "action": "backtest.run",
        "target_type": "backtest",
        "target_id": "run_1",
        "summary": "Queued a backtest",
    }
    return AuditEntry(**(fields | over))


def _candle(**over: Any) -> Candle:
    fields: dict[str, Any] = {
        "exchange": "NSE",
        "symbol": "INFY",
        "timeframe": "1d",
        "ts": NOW,
        "open_paise": 150_000,
        "high_paise": 152_000,
        "low_paise": 149_000,
        "close_paise": 151_000,
        "volume": 1_000_000,
    }
    return Candle(**(fields | over))


Factory = Callable[..., Base]
CASES: list[tuple[str, Factory, dict[str, Any]]] = [
    ("run status", _run, {"status": "done"}),
    ("run period", _run, {"date_from": date(2026, 1, 1)}),
    ("run capital", _run, {"initial_capital_paise": 0}),
    ("run error only when failed", _run, {"error": "boom"}),
    ("run benchmark", _run, {"benchmark": "SENSEX"}),
    ("run unknown strategy version", _run, {"strategy_version": 2}),
    ("result net", _result, {"net_pnl_paise": 1_000}),
    ("result drawdown", _result, {"max_drawdown_percent": Decimal("1")}),
    ("result counts", _result, {"win_count": 3}),
    ("result win rate", _result, {"win_rate_percent": Decimal("101")}),
    ("trade net", _trade, {"net_pnl_paise": 10_000}),
    ("trade charges total", _trade, {"charges_total_paise": 80, "net_pnl_paise": 9_920}),
    ("trade exit pair", _trade, {"exit_price_paise": None}),
    ("trade qty", _trade, {"qty": 0}),
    ("trade side", _trade, {"side": "short"}),
    ("rule nova above broker", _rule, {"nova_limit": 5_001}),
    ("rule window", _rule, {"rate_window": "hour"}),
    ("session triple", _broker_session, {"access_token_encrypted": None}),
    ("session order", _broker_session, {"expires_at": NOW - timedelta(hours=1)}),
    ("job download needs period", _job, {"timeframe": None}),
    ("job completed at 100", _job, {"progress_percent": Decimal("99")}),
    ("job queued not started", _job, {"status": "queued", "progress_percent": Decimal("0")}),
    ("job no symbols", _job, {"symbols": []}),
    ("job tick record timeframe", _job, {"type": "tick_record"}),
    ("audit action", _audit, {"action": "backtest.delete"}),
    ("audit target pair", _audit, {"target_id": None}),
    ("candle high", _candle, {"high_paise": 150_500}),
    ("candle low", _candle, {"low_paise": 151_500}),
    ("candle timeframe", _candle, {"timeframe": "2h"}),
]


@pytest.fixture
def seeded(session: Session) -> Session:
    session.add(Strategy(id="stg_1", name="Test", status="active", latest_version=1))
    session.flush()
    session.add(StrategyVersion(strategy_id="stg_1", version=1, spec=SPEC))
    session.add(BrokerAccount(id="brk_1", broker="zerodha", label="Main", client_id="AB1234"))
    session.flush()
    return session


def test_valid_rows_are_accepted(seeded: Session) -> None:
    seeded.add(_run())
    seeded.flush()
    seeded.add_all([_result(), _trade(), _rule(), _broker_session(), _job(), _audit(), _candle()])
    seeded.flush()


@pytest.mark.parametrize(
    ("factory", "overrides"), [(f, o) for _, f, o in CASES], ids=[name for name, _, _ in CASES]
)
def test_bad_row_is_rejected(seeded: Session, factory: Factory, overrides: dict[str, Any]) -> None:
    if factory in (_result, _trade):
        seeded.add(_run())
        seeded.flush()

    with pytest.raises(IntegrityError), seeded.begin_nested():
        seeded.add(factory(**overrides))
        seeded.flush()
