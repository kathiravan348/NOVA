"""Candles built from recorded ticks, and a recorded run end to end (D82 (3), (4))."""

import threading
from datetime import UTC, date, datetime, timedelta
from pathlib import Path
from typing import Any

import pyarrow as pa
import pyarrow.parquet as pq
import pytest
from fastapi.testclient import TestClient
from nova_backtest.strategy_engine import StrategyEngine
from nova_backtest.tick_bars import archive_path, read_tick_bars, timeframe_seconds, usable_days
from nova_backtest.worker import run_worker
from nova_db.candles import BarRow
from nova_db.models import BacktestRun, StrategyVersion, Tick, TickDay, TickSession
from sqlalchemy import Engine, delete, insert
from sqlalchemy.orm import Session, sessionmaker

THU, FRI = date(2026, 10, 1), date(2026, 10, 2)


def ist(day: date, hour: int, minute: int, second: float = 0) -> datetime:
    whole = int(second)
    micro = round((second - whole) * 1_000_000)
    return datetime(
        day.year, day.month, day.day, hour, minute, whole, micro, tzinfo=UTC
    ) - timedelta(hours=5, minutes=30)


def tick(
    at: datetime | None, received: datetime, price: int, volume: int, symbol: str = "INFY"
) -> dict[str, Any]:
    return {
        "exchange": "NSE",
        "symbol": symbol,
        "received_at": received,
        "exchange_ts": at,
        "last_price_paise": price,
        "last_qty": 1,
        "volume": volume,
    }


def day_ticks(day: date) -> list[dict[str, Any]]:
    """09:14:59 and 15:30:00 fall outside the session; one tick has no exchange time."""
    return [
        tick(ist(day, 9, 14, 59), ist(day, 9, 14, 59.5), 10_000, 5),
        tick(ist(day, 9, 15), ist(day, 9, 15, 0.2), 10_100, 10),
        tick(ist(day, 9, 15), ist(day, 9, 15, 0.6), 10_300, 12),  # same second, later
        tick(None, ist(day, 9, 15, 1.2), 99_900, 15),
        tick(ist(day, 9, 15, 2), ist(day, 9, 15, 2.3), 10_200, 20),
        tick(ist(day, 9, 16, 30), ist(day, 9, 16, 30.4), 10_400, 30),
        tick(ist(day, 15, 30), ist(day, 15, 30, 0.4), 20_000, 99),
    ]


def bars(rows: list[BarRow]) -> list[tuple[datetime, int, int, int, int, int]]:
    return [(r.ts, r.open_paise, r.high_paise, r.low_paise, r.close_paise, r.volume) for r in rows]


EXPECTED_1S = [
    (ist(THU, 9, 15), 10_100, 10_300, 10_100, 10_300, 12),
    (ist(THU, 9, 15, 2), 10_200, 10_200, 10_200, 10_200, 8),
    (ist(THU, 9, 16, 30), 10_400, 10_400, 10_400, 10_400, 10),
]
EXPECTED_1M = [
    (ist(THU, 9, 15), 10_100, 10_300, 10_100, 10_200, 20),
    (ist(THU, 9, 16), 10_400, 10_400, 10_400, 10_400, 10),
]


def test_database_ticks_become_1s_and_1m_candles(clean: Engine, tmp_path: Path) -> None:
    with Session(clean) as db:
        db.execute(insert(Tick), day_ticks(THU))
        db.commit()
        assert bars(read_tick_bars(db, tmp_path, "NSE", "INFY", "1s", THU)) == EXPECTED_1S
        assert bars(read_tick_bars(db, tmp_path, "NSE", "INFY", "1m", THU)) == EXPECTED_1M
        assert read_tick_bars(db, tmp_path, "NSE", "TCS", "1m", THU) == []


def test_archived_ticks_give_the_same_candles(clean: Engine, tmp_path: Path) -> None:
    rows = day_ticks(THU)
    path = archive_path(tmp_path, THU, "INFY")
    path.parent.mkdir(parents=True)
    stamp = pa.timestamp("us", tz="UTC")
    table = pa.table(
        {
            "exchange": pa.array([r["exchange"] for r in rows]),
            "symbol": pa.array([r["symbol"] for r in rows]),
            "received_at": pa.array([r["received_at"] for r in rows], type=stamp),
            "exchange_ts": pa.array([r["exchange_ts"] for r in rows], type=stamp),
            "last_price_paise": pa.array([r["last_price_paise"] for r in rows], type=pa.int64()),
            "volume": pa.array([r["volume"] for r in rows], type=pa.int64()),
        }
    )
    pq.write_table(table, path)
    with Session(clean) as db:  # nothing in the database: the archive is read
        assert bars(read_tick_bars(db, tmp_path, "NSE", "INFY", "1s", THU)) == EXPECTED_1S
        assert bars(read_tick_bars(db, tmp_path, "NSE", "INFY", "1m", THU)) == EXPECTED_1M


def test_usable_days_skip_feed_gaps_and_unrecorded_stocks(clean: Engine) -> None:
    with Session(clean) as db:
        db.add_all(
            [
                TickSession(
                    day=THU, stocks=2, ticks=9, feed_gap_seconds=28, summarized_at=ist(THU, 16, 0)
                ),
                TickSession(
                    day=FRI, stocks=1, ticks=9, feed_gap_seconds=400, summarized_at=ist(FRI, 16, 0)
                ),
                TickDay(
                    exchange="NSE",
                    symbol="INFY",
                    day=THU,
                    ticks=5,
                    size_bytes=1,
                    seconds_with_tick=3,
                ),
                TickDay(
                    exchange="NSE",
                    symbol="INFY",
                    day=FRI,
                    ticks=5,
                    size_bytes=1,
                    seconds_with_tick=3,
                ),
            ]
        )
        db.commit()
        days = usable_days(db, "NSE", ["INFY", "TCS"], THU, FRI)
    assert days.sessions == [THU] and days.skipped == [FRI]
    assert days.by_symbol == {"INFY": [THU], "TCS": []}


def test_widths() -> None:
    assert [timeframe_seconds(t) for t in ("1s", "5s", "30s", "1m", "1h")] == [1, 5, 30, 60, 3600]
    with pytest.raises(ValueError, match="Recorded data has no 1d candles"):
        timeframe_seconds("1d")


ABOVE_105 = {
    "left": {"kind": "price", "field": "close"},
    "op": "gt",
    "right": {"kind": "number", "value": 105},
}
BELOW_50 = ABOVE_105 | {"op": "lt", "right": {"kind": "number", "value": 50}}
INTRADAY_1M = {
    "mode": "visual",
    "segment": "equity_intraday",
    "exchange": "NSE",
    "timeframe": "1m",
    "sizing": {"type": "fixed_qty", "qty": 10},
    "risk": {"stopLossPercent": None, "targetPercent": None},
    "entry": {"combinator": "all", "conditions": [ABOVE_105]},
    "exit": {"combinator": "all", "conditions": [BELOW_50]},
}


def test_a_recorded_run_trades_on_tick_candles_and_reports_its_days(
    clean: Engine, factory: sessionmaker[Session], client: TestClient, tmp_path: Path
) -> None:
    received = timedelta(milliseconds=400)
    prices = [(ist(THU, 9, 15, 5), 10_000), (ist(THU, 9, 16, 5), 10_600)]  # 09:16 closes > 105
    prices += [(ist(THU, 9, 17, 5), 10_700), (ist(THU, 15, 21, 5), 10_800)]
    with Session(clean) as db:
        db.add(StrategyVersion(strategy_id="stg_1", version=2, spec=INTRADAY_1M))
        db.flush()
        db.execute(
            insert(Tick),
            [tick(at, at + received, p, 100 * (i + 1)) for i, (at, p) in enumerate(prices)],
        )
        db.add_all(
            [
                TickSession(
                    day=THU, stocks=1, ticks=4, feed_gap_seconds=0, summarized_at=ist(THU, 16, 0)
                ),
                TickSession(
                    day=FRI, stocks=1, ticks=4, feed_gap_seconds=900, summarized_at=ist(FRI, 16, 0)
                ),
                TickDay(
                    exchange="NSE",
                    symbol="INFY",
                    day=THU,
                    ticks=4,
                    size_bytes=1,
                    seconds_with_tick=4,
                ),
            ]
        )
        db.add(
            BacktestRun(
                id="run_rec",
                strategy_id="stg_1",
                strategy_version=2,
                name="Recorded",
                universe={"type": "symbols", "symbols": ["INFY"]},
                status="queued",
                date_from=THU,
                date_to=FRI,
                initial_capital_paise=10_000_000,
                benchmark=None,
                data_source="recorded",
            )
        )
        db.commit()
    stop = threading.Event()
    run_worker(
        factory, StrategyEngine(archive_root=tmp_path), stop, poll_seconds=0, on_idle=stop.set
    )

    run = client.get("/api/v1/backtests/run_rec").json()
    assert run["status"] == "completed", run["error"]
    assert run["recordedDaysUsed"] == 1 and run["recordedDaysSkipped"] == ["2026-10-02"]
    (trade,) = client.get("/api/v1/backtests/run_rec/trades").json()["items"]
    assert (trade["entryPricePaise"], trade["exitPricePaise"]) == (10_700, 10_800)
    assert trade["entryAt"] == "2026-10-01T03:47:00Z"  # the 09:17 IST bar opens
    assert trade["exitAt"] == "2026-10-01T09:51:00Z"  # first bar from 15:20 IST: 15:21


def test_a_recorded_run_without_usable_days_fails_plainly(
    clean: Engine, factory: sessionmaker[Session], tmp_path: Path
) -> None:
    with Session(clean) as db:
        db.add(StrategyVersion(strategy_id="stg_1", version=2, spec=INTRADAY_1M))
        db.flush()
        db.add(
            BacktestRun(
                id="run_none",
                strategy_id="stg_1",
                strategy_version=2,
                name="Recorded",
                universe={"type": "symbols", "symbols": ["INFY"]},
                status="queued",
                date_from=THU,
                date_to=THU,
                initial_capital_paise=10_000_000,
                benchmark=None,
                data_source="recorded",
            )
        )
        db.commit()
    stop = threading.Event()
    run_worker(
        factory, StrategyEngine(archive_root=tmp_path), stop, poll_seconds=0, on_idle=stop.set
    )
    with Session(clean) as db:
        db.execute(delete(Tick))
        run = db.get(BacktestRun, "run_none")
        assert run is not None
        assert run.status == "failed" and run.error == "No usable recorded days in this period"


def test_a_recorded_run_fills_at_ask_and_bid_and_reports_the_spread_cost(
    clean: Engine, factory: sessionmaker[Session], client: TestClient, tmp_path: Path
) -> None:
    """Buy at 107.10 (ask; last 107.00), square off at 107.95 (bid; last 108.00): 10 shares,
    spread cost 10 × 10 + 10 × 5 = 150 paise (D82 (5))."""
    received = timedelta(milliseconds=400)
    rows = [
        tick(ist(THU, 9, 15, 5), ist(THU, 9, 15, 5) + received, 10_000, 100),
        tick(ist(THU, 9, 16, 5), ist(THU, 9, 16, 5) + received, 10_600, 200),
        tick(ist(THU, 9, 17, 5), ist(THU, 9, 17, 5) + received, 10_700, 300)
        | {"bid_price_paise": [10_690], "ask_price_paise": [10_710]},
        tick(ist(THU, 15, 21, 5), ist(THU, 15, 21, 5) + received, 10_800, 400)
        | {"bid_price_paise": [10_795], "ask_price_paise": [10_805]},
    ]
    with Session(clean) as db:
        db.add(StrategyVersion(strategy_id="stg_1", version=2, spec=INTRADAY_1M))
        db.flush()
        db.execute(insert(Tick), rows)
        db.add_all(
            [
                TickSession(
                    day=THU, stocks=1, ticks=4, feed_gap_seconds=0, summarized_at=ist(THU, 16, 0)
                ),
                TickDay(
                    exchange="NSE",
                    symbol="INFY",
                    day=THU,
                    ticks=4,
                    size_bytes=1,
                    seconds_with_tick=4,
                ),
                BacktestRun(
                    id="run_spread",
                    strategy_id="stg_1",
                    strategy_version=2,
                    name="Recorded",
                    universe={"type": "symbols", "symbols": ["INFY"]},
                    status="queued",
                    date_from=THU,
                    date_to=THU,
                    initial_capital_paise=10_000_000,
                    benchmark=None,
                    data_source="recorded",
                ),
            ]
        )
        db.commit()
    stop = threading.Event()
    engine = StrategyEngine(archive_root=tmp_path)
    run_worker(factory, engine, stop, poll_seconds=0, on_idle=stop.set)

    (trade,) = client.get("/api/v1/backtests/run_spread/trades").json()["items"]
    assert (trade["entryPricePaise"], trade["exitPricePaise"]) == (10_710, 10_795)
    metrics = client.get("/api/v1/backtests/run_spread/result").json()["metrics"]
    assert metrics["spreadCostPaise"] == 150
