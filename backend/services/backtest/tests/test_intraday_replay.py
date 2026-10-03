import threading
from dataclasses import replace
from datetime import date
from pathlib import Path

import pytest
from intraday_factory import (
    BASE,
    ScriptedSetup,
    T,
    flat_charges,
    insert_session,
    insert_ticks,
    minute_tape,
    ms,
    replay,
    seed_intraday_run,
    timing,
)
from nova_backtest.intraday.dispatch import DispatchEngine
from nova_backtest.intraday.engine import IntradayEngine
from nova_backtest.intraday.position import Position
from nova_backtest.intraday.replay import DayReplay, Pending
from nova_backtest.intraday.setups import REGISTRY
from nova_backtest.strategy_engine import StrategyEngine
from nova_backtest.worker import run_worker
from nova_db.models import BacktestRun, IntradayTrade, Trade
from nova_testing.parity import Parity
from sqlalchemy import Engine, select
from sqlalchemy.orm import Session, sessionmaker

ENTRY = {"09:45": {"stop": 9_900, "target_r": 2.0}}  # candidate at the 09:45 close


def calm(until: str = "15:30:00", price: int = 10_000) -> list[T]:
    return minute_tape("09:15:00", until, price, spread=4)


def only(run: DayReplay) -> Position:
    assert len(run.closed) == 1
    return run.closed[0]


def test_entry_fills_after_the_delay_and_the_stop_triggers_on_the_bid() -> None:
    tape = [*calm("09:50:00"), T("09:50:00", 9_910, bid=9_900, ask=9_904)]
    tape += minute_tape("09:50:20", "15:30:00", 9_890, spread=4)
    run = replay({"INFY": tape}, {"INFY": ENTRY})
    position = only(run)
    assert run.decisions[0].outcome == "filled" and run.decisions[0].filled_qty == 100
    assert position.buys[0].at_ms == ms("09:45:00.250")
    assert (position.first_fill, position.target) == (10_002, 10_002 + 2 * 102)
    assert position.exit_reason == "stop" and position.closed
    # bid ≤ stop at 09:50:00 → the sell may fill from 09:50:00.250: the next tick, at 09:50:20
    assert position.sells[0].at_ms == ms("09:50:20") and position.sells[0].value == 100 * 9_888


def test_target_time_exit_and_square_off() -> None:
    up = [*calm("10:00:00"), T("10:00:00", 10_250, bid=10_210, ask=10_214)]
    up += minute_tape("10:00:20", "15:30:00", 10_250, spread=4)
    target = only(replay({"INFY": up}, {"INFY": ENTRY}))
    assert target.exit_reason == "target" and target.sells[0].at_ms == ms("10:00:20")

    held = only(replay({"INFY": calm()}, {"INFY": ENTRY}))
    assert held.exit_reason == "time_exit"
    assert held.sells[0].at_ms == ms("10:45:20")  # 10:45:00.250 → the next tick

    late = only(
        replay({"INFY": calm()}, {"INFY": {"14:20": ENTRY["09:45"]}}, when=timing(hold=375))
    )
    assert late.exit_reason == "square_off" and late.sells[0].at_ms == ms("15:20:20")


def test_exit_walks_the_bid_depth_and_retries_the_rest() -> None:
    tape = [*calm("09:50:00"), T("09:50:00", 9_910, bid=9_900, ask=9_904)]
    tape += minute_tape("09:50:20", "15:30:00", 9_890, spread=4, bid_qty=300)  # 30 a level
    position = only(replay({"INFY": tape}, {"INFY": ENTRY}, qty=200))
    assert [o.qty for o in position.sells] == [150, 50]
    assert position.sells[1].at_ms == ms("09:50:40")


def test_no_bid_by_the_session_end_is_unresolved_at_the_last_bid() -> None:
    tape = [*calm("15:00:00"), *[T(f"15:{m:02d}:00", 10_000) for m in range(0, 30)]]
    position = only(
        replay({"INFY": tape}, {"INFY": {"14:20": ENTRY["09:45"]}}, when=timing(hold=375))
    )
    assert position.unresolved and position.exit_reason == "unresolved"
    last_bid = 9_998  # the calm tape's bid; the later ticks have none
    assert position.sells[0].value == 100 * last_bid
    assert position.trade().exit_reason == "unresolved"


def test_entry_refusals_are_kept_with_their_reasons() -> None:
    wide = minute_tape("09:15:00", "15:30:00", 10_000, spread=40)
    run = replay({"INFY": wide}, {"INFY": ENTRY})
    assert run.closed == [] and run.decisions[0].first_reason == "wide_spread"
    early = replay({"INFY": calm()}, {"INFY": {"09:20": ENTRY["09:45"]}})
    assert early.decisions[0].first_reason == "entry_window"
    zero = replay({"INFY": calm()}, {"INFY": ENTRY}, qty=0)
    assert zero.decisions[0].reasons == ["zero_qty"]
    above = replay({"INFY": calm()}, {"INFY": {"09:45": {"stop": 10_005, "target_r": 2.0}}})
    assert above.decisions[0].first_reason == "invalid_at_fill"


def test_a_frozen_target_needs_its_reward_room_at_the_fill() -> None:
    room = {"09:45": {"stop": 9_900, "target": 10_206, "min_reward_r": 2.0}}
    assert replay({"INFY": calm()}, {"INFY": room}).decisions[0].outcome == "filled"
    tight = {"09:45": {"stop": 9_900, "target": 10_200, "min_reward_r": 2.0}}
    assert replay({"INFY": calm()}, {"INFY": tight}).decisions[0].first_reason == "invalid_at_fill"


def test_exits_come_before_entries_at_the_same_time() -> None:
    calls: list[str] = []

    class Logged(DayReplay):
        def _sell(self, position: Position, i: int) -> None:
            calls.append(f"sell {position.symbol}")
            super()._sell(position, i)

        def _attempt(self, pending: Pending) -> None:
            calls.append("buy")
            super()._attempt(pending)

    # A's stop fills from 09:50:00.250; B's 09:50 candidate is tried at 09:50:00.250 too.
    a = [*calm("09:50:00"), T("09:50:00", 9_910, bid=9_900, ask=9_904)]
    a += [T("09:50:00.250", 9_890, bid=9_888, ask=9_892)]
    a += minute_tape("09:50:20", "15:30:00", 9_890, spread=4)
    b = calm()
    replay({"A": a, "B": b}, {"A": ENTRY, "B": {"09:50": ENTRY["09:45"]}}, cls=Logged)
    assert calls[:3] == ["buy", "sell A", "buy"]  # A's entry at 09:45, then A's exit before B


def test_order_charges_are_kept_per_order() -> None:
    tape = [*calm("09:50:00"), T("09:50:00", 9_910, bid=9_900, ask=9_904)]
    tape += minute_tape("09:50:20", "15:30:00", 9_890, spread=4)
    run = replay({"INFY": tape}, {"INFY": ENTRY}, charges=flat_charges(2_000))
    trade = only(run).trade()
    assert trade.charges.total_paise == 4_000
    assert trade.gross == 100 * 9_888 - 100 * 10_002 and trade.net == trade.gross - 4_000


def test_stress_slippage_moves_both_fills() -> None:
    tape = [*calm("09:50:00"), T("09:50:00", 9_910, bid=9_900, ask=9_904)]
    tape += minute_tape("09:50:20", "15:30:00", 9_890, spread=4)
    stress = replace(BASE, delay_ms=1000, slippage_ticks=3)
    position = only(replay({"INFY": tape}, {"INFY": ENTRY}, execution=stress))
    assert position.buys[0].value == 100 * (10_002 + 15)
    assert position.sells[0].value == 100 * (9_888 - 15)


def test_an_intraday_run_goes_end_to_end_through_the_worker(
    factory: sessionmaker[Session],
    clean: Engine,
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
    parity: Parity,
) -> None:
    plan = {"09:45": {"stop": 9_900, "target_r": 2.0}}
    monkeypatch.setitem(
        REGISTRY, "opening_range_retest", lambda _s, stock: ScriptedSetup(stock, plan)
    )
    tape = [*calm("09:50:00"), T("09:50:00", 9_910, bid=9_900, ask=9_904)]
    tape += minute_tape("09:50:20", "15:30:00", 9_890, spread=4)
    with factory() as db:
        insert_session(db)
        insert_ticks(db, "INFY", tape)
        insert_session(db, date(2026, 10, 5), longest_gap=45)  # too long a feed gap: skipped
        seed_intraday_run(db, ["INFY"], last=date(2026, 10, 5))
    stop = threading.Event()
    engine = DispatchEngine(StrategyEngine(), IntradayEngine(tmp_path, tmp_path))
    run_worker(factory, engine, stop, poll_seconds=0, on_idle=stop.set)

    with factory() as db:
        run = db.get(BacktestRun, "run_i")
        assert run is not None and run.status == "completed", run and run.error
        assert (run.recorded_days_used, run.recorded_days_skipped) == (1, [date(2026, 10, 5)])
        assert run.history_inputs == ["tick_size:INFY"] and run.incomplete is False
        (trade,) = db.scalars(select(Trade).where(Trade.run_id == "run_i")).all()
        detail = db.get(IntradayTrade, trade.id)
        assert detail is not None
    # Default profile: 250 ms delay, 1 tick (5 paise) slippage on each side.
    assert (trade.qty, trade.entry_price_paise, trade.exit_price_paise) == (1, 10_007, 9_883)
    assert trade.exit_reason == "stop" and trade.charges_total_paise > 0
    assert trade.gross_pnl_paise == 9_883 - 10_007
    assert (detail.stop_paise, detail.first_fill_paise, detail.risk_paise) == (9_900, 10_007, 107)
    assert detail.target_paise == 10_007 + 2 * 107 and detail.unresolved is False
    assert detail.legs == [{"at": "2026-10-01T04:15:00.250000+00:00", "qty": 1, "price": 10_007}]
    assert list(tmp_path.iterdir()) == []  # the scratch folder is gone


def test_an_intraday_run_without_its_setup_fails_plainly(
    factory: sessionmaker[Session], clean: Engine, tmp_path: Path
) -> None:
    with factory() as db:
        insert_session(db)
        insert_ticks(db, "INFY", calm())
        seed_intraday_run(db, ["INFY"])
    stop = threading.Event()
    engine = DispatchEngine(StrategyEngine(), IntradayEngine(tmp_path, tmp_path))
    run_worker(factory, engine, stop, poll_seconds=0, on_idle=stop.set)
    with factory() as db:
        run = db.get(BacktestRun, "run_i")
        assert run is not None and run.status == "failed"
        assert run.error == "The opening_range_retest setup arrives in NOVA-188/189"
