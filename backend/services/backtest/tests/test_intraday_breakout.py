import threading
from datetime import date
from pathlib import Path
from typing import Any

import numpy as np
import pytest
from intraday_factory import (
    Ohlc,
    bar_tape,
    flat_minutes,
    insert_history_days,
    insert_session,
    insert_ticks,
    live_replay,
    ms,
    research_settings,
    seed_intraday_run,
    stock_day,
)
from nova_backtest.intraday.context import StockContext
from nova_backtest.intraday.dispatch import DispatchEngine
from nova_backtest.intraday.engine import IntradayEngine
from nova_backtest.intraday.setups import Candidate, StockDay, factory_for
from nova_backtest.strategy_engine import StrategyEngine
from nova_backtest.worker import run_worker
from nova_contracts import IntradaySetup
from nova_db.models import BacktestRun, IntradayTrade, Trade
from pydantic import TypeAdapter
from sqlalchemy import Engine, select
from sqlalchemy.orm import Session, sessionmaker

SETUP: TypeAdapter[IntradaySetup] = TypeAdapter(IntradaySetup)
ORR = {"kind": "opening_range_retest", "rangeMinutes": 15, "retestBars": 3, "bufferAtr": 0.1,
       "targetR": 2}  # fmt: skip


def with_context(stock: StockDay, atr: float, prev_high: int | None = None) -> StockDay:
    n = len(stock.bars1)
    nan = np.full(n, np.nan)
    context = StockContext(
        atr=np.full(n, atr),
        ema=nan,
        ema_before=nan,
        close5=nan,
        span6=nan,
        vwap=nan,
        rel_volume=nan,
        prev_high=prev_high,
        prev_low=None,
        sources=frozenset(),
    )
    return StockDay(stock.symbol, stock.day, stock.ticks, stock.bars1, stock.bars5, context)


def candidates(minutes: list[Ohlc], setup: dict[str, Any], atr: float = 100.0,
               prev_high: int | None = None) -> list[Candidate]:  # fmt: skip
    stock = with_context(stock_day("INFY", bar_tape(minutes)), atr, prev_high)
    spec = SETUP.validate_python(setup)
    machine = factory_for(spec)(spec, stock)
    found = [machine.on_bar(i) for i in range(len(stock.bars1))]
    return [c for c in found if c is not None]


# The opening range 09:15–09:30 from ₹100.00 to ₹102.00 (guide ch. 9).
OPENING: list[Ohlc] = [(f"09:{m}", 10_100, 10_200, 10_000, 10_100) for m in range(15, 30)]


def test_opening_range_retest_guide_example() -> None:
    # ATR ₹1 → buffer ₹0.10: breakout close ₹102.20, retest low ₹101.50 and close ₹102.15.
    found = candidates(
        OPENING
        + [
            ("09:30", 10_150, 10_230, 10_150, 10_220),
            ("09:31", 10_210, 10_220, 10_150, 10_215),
        ],  # fmt: skip
        ORR,
    )
    (candidate,) = found
    assert (candidate.stop, candidate.price, candidate.family) == (10_150, 10_215, "trend")
    assert candidate.at_ms == ms("09:32:00")  # the retest bar's close
    assert candidate.target_r == 2.0 and candidate.target is None


def test_opening_range_retest_negative_cases() -> None:
    # The breakout bar dips to the OR high itself: it is not its own retest.
    own = [("09:30", 10_150, 10_230, 10_100, 10_220), ("09:31", 10_220, 10_240, 10_215, 10_230)]
    assert candidates(OPENING + own, ORR) == []
    # The retest comes on the 4th bar after the breakout: too late with retestBars 3.
    late = [("09:30", 10_150, 10_230, 10_150, 10_220)]
    late += [(f"09:3{m}", 10_225, 10_240, 10_215, 10_230) for m in (1, 2, 3)]
    late += [("09:34", 10_210, 10_220, 10_150, 10_215)]
    assert candidates(OPENING + late, ORR) == []
    # A zero-width opening range sets nothing up.
    flat = [(f"09:{m}", 10_000, 10_000, 10_000, 10_000) for m in range(15, 30)]
    assert candidates(flat + late[:1] + [("09:31", 10_010, 10_020, 9_990, 10_015)], ORR) == []
    # A close below the OR high ends the sequence; a fresh breakout starts a new one.
    failed = [("09:30", 10_150, 10_230, 10_150, 10_220), ("09:31", 10_200, 10_200, 10_100, 10_150)]
    again = [("09:32", 10_150, 10_230, 10_150, 10_220), ("09:33", 10_210, 10_220, 10_150, 10_215)]
    (one,) = candidates(OPENING + failed + again, ORR)
    assert one.stop == 10_150 and one.bar == len(OPENING) + 3


def test_previous_day_high_retest_guide_example() -> None:
    # PDH ₹102, buffer ₹0.10: breakout close ₹102.15, retest low ₹101.60, close ₹102.12.
    setup = {"kind": "prev_day_high_retest", "retestBars": 3, "bufferAtr": 0.1, "targetR": 2}
    minutes: list[Ohlc] = [("09:15", 10_150, 10_180, 10_100, 10_150)]
    minutes += [("09:16", 10_160, 10_220, 10_150, 10_215), ("09:17", 10_210, 10_215, 10_160,
                                                              10_212)]  # fmt: skip
    (candidate,) = candidates(minutes, setup, prev_high=10_200)
    assert candidate.stop == 10_160
    assert candidates(minutes, setup, prev_high=None) == []  # no previous session: no setup


def test_inside_bar_guide_example() -> None:
    # Mother ₹100–104, inside ₹101–103, ATR ₹2 → trigger above ₹104.20, stop ₹100.
    setup = {"kind": "inside_bar_continuation", "expiryBars": 3, "bufferAtr": 0.1, "targetR": 2}
    base: list[Ohlc] = [("09:40", 10_100, 10_400, 10_000, 10_300), ("09:41", 10_200, 10_300,
                                                                    10_100, 10_250)]  # fmt: skip
    equal = [("09:42", 10_300, 10_420, 10_250, 10_420)]  # a close at the trigger is not above it
    above = [("09:42", 10_300, 10_430, 10_250, 10_425)]
    assert candidates(base + equal, setup, atr=200.0) == []
    (candidate,) = candidates(base + above, setup, atr=200.0)
    assert (candidate.stop, candidate.price) == (10_000, 10_425)
    touching = [("09:40", 10_100, 10_400, 10_000, 10_300), ("09:41", 10_200, 10_400, 10_100,
                                                              10_250)]  # fmt: skip
    assert candidates(touching + above, setup, atr=200.0) == []  # equal high: not inside
    nested = base + [("09:42", 10_200, 10_280, 10_150, 10_250)]  # inside again: no new expiry
    late = nested + [(f"09:4{m}", 10_250, 10_260, 10_200, 10_250) for m in (3, 4)]
    assert candidates(late + [("09:45", 10_300, 10_430, 10_250, 10_425)], setup, atr=200.0) == []


def rising(start: str, end: str, first: int, step: int = 2, half: int = 10) -> list[Ohlc]:
    """Bars creeping up `step` paise a minute (keeps the 5m EMA rising)."""
    bars = flat_minutes(start, end, 0)
    return [(c, first + k * step, first + k * step + half, first + k * step - half,
             first + k * step) for k, (c, *_r) in enumerate(bars)]  # fmt: skip


def finish(after: str, price: int) -> list[Ohlc]:
    return flat_minutes(after, "15:30", price, half=5)


SCENARIOS: dict[str, tuple[dict[str, Any], list[Ohlc]]] = {
    "opening_range_retest": (
        dict(ORR),
        [(f"09:{m}", 10_050, 10_100, 10_000, 10_050) for m in range(15, 30)]
        + [("09:30", 10_060, 10_130, 10_060, 10_125), ("09:31", 10_120, 10_125, 10_060, 10_120)]
        + rising("09:32", "09:40", 10_150, step=20)
        + finish("09:40", 10_300),
    ),
    "prev_day_high_retest": (
        {"kind": "prev_day_high_retest", "retestBars": 3, "bufferAtr": 0.1, "targetR": 2},
        rising("09:15", "09:45", 9_960)
        + [("09:45", 10_020, 10_080, 10_020, 10_075), ("09:46", 10_070, 10_072, 10_010, 10_068)]
        + rising("09:47", "09:55", 10_100, step=20)
        + finish("09:55", 10_300),
    ),
    "inside_bar_continuation": (
        {"kind": "inside_bar_continuation", "expiryBars": 3, "bufferAtr": 0.1, "targetR": 2},
        rising("09:15", "09:40", 10_050)
        + [("09:40", 10_100, 10_140, 10_060, 10_120), ("09:41", 10_110, 10_130, 10_070, 10_120)]
        + [("09:42", 10_130, 10_160, 10_125, 10_155)]
        + rising("09:43", "09:55", 10_200, step=20)
        + finish("09:55", 10_400),
    ),
}


@pytest.mark.parametrize("kind", list(SCENARIOS))
def test_each_setup_trades_end_to_end_with_single_buying(kind: str) -> None:
    setup, minutes = SCENARIOS[kind]
    run = live_replay({"INFY": bar_tape(minutes, vwap=9_900)}, setup)
    filled = [d for d in run.decisions if d.outcome != "skipped"]
    assert len(filled) == 1, [(d.at_ms, d.reasons) for d in run.decisions]
    (position,) = run.closed
    assert position.exit_reason == "target" and position.candidate.setup == kind
    assert position.target == position.first_fill + 2 * (position.first_fill - position.stop)
    assert position.trade().net > 0


def test_opening_range_retest_runs_through_the_worker(
    factory: sessionmaker[Session], clean: Engine, tmp_path: Path
) -> None:
    _setup, minutes = SCENARIOS["opening_range_retest"]
    settings = research_settings(market={"marketGate": False}, signal={"volumeBaselineSessions": 5})
    with factory() as db:
        insert_session(db)
        insert_ticks(db, "INFY", bar_tape(minutes, vwap=9_900))
        insert_history_days(db, "INFY", [date(2026, 9, d) for d in (24, 25, 28, 29, 30)])
        seed_intraday_run(db, ["INFY"], settings=settings)
    stop = threading.Event()
    run_worker(factory, DispatchEngine(StrategyEngine(), IntradayEngine(tmp_path, tmp_path)),
               stop, poll_seconds=0, on_idle=stop.set)  # fmt: skip
    with factory() as db:
        run = db.get(BacktestRun, "run_i")
        assert run is not None and run.status == "completed", run and run.error
        (trade,) = db.scalars(select(Trade).where(Trade.run_id == "run_i")).all()
        detail = db.get(IntradayTrade, trade.id)
    assert detail is not None and detail.stop_paise == 10_060
    assert trade.exit_reason == "target" and trade.net_pnl_paise > 0
