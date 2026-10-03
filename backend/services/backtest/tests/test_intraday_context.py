import math
from datetime import date
from pathlib import Path

import numpy as np
from intraday_factory import DAY, T, minute_tape, ms, stock_day
from nova_backtest.intraday.context import DayBars, History, build_context, cumulative_volume
from nova_backtest.intraday.gate import IndexGate
from nova_backtest.intraday.guard import SignalChecks
from nova_backtest.intraday.setups import Candidate
from nova_backtest.intraday.tick_data import session_ms
from nova_backtest.intraday.warmup import Warmup
from nova_contracts import default_research_settings
from sqlalchemy import Engine
from sqlalchemy.orm import Session, sessionmaker

SIGNAL = default_research_settings().signal


def session(day: date, price: int = 10_000, half: int = 50, volume: int = 1_000) -> DayBars:
    """A whole earlier session of flat 1m bars (Kite history)."""
    open_ms, _ = session_ms(day)
    start = open_ms + np.arange(375, dtype=np.int64) * 60_000

    def same(value: int) -> np.ndarray:
        return np.full(375, value, dtype=np.int64)

    return DayBars(
        open_ms,
        start,
        same(price + half),
        same(price - half),
        same(price),
        same(price),
        same(volume),
        "history",
    )


EARLIER = [session(date(2026, 9, d)) for d in (10, 11, 12, 15, 16, 17, 18, 19, 22, 23)]
EARLIER += [session(date(2026, 9, d)) for d in (24, 25, 26, 29, 30)]
EARLIER += [session(date(2026, 9, d)) for d in (1, 2, 3, 4, 5)]  # 20 sessions (order is all)


def test_atr_matches_a_hand_calculation() -> None:
    # Three 5m bars with ranges 40, 60 and a gap up: TRs 40, 60, 100 → Wilder(2): 50, then 75.
    tape = [
        T("09:15:00", 10_000),
        T("09:19:00", 10_040),
        T("09:20:00", 10_040),
        T("09:24:00", 10_100),
        T("09:25:00", 10_200),
        T("09:29:00", 10_180),
    ]
    stock = stock_day("INFY", tape)
    context = build_context(
        stock.bars1, stock.bars5, History(), SIGNAL.model_copy(update={"atr_period": 2})
    )
    by_close = dict(zip(stock.bars1.end.tolist(), context.atr.tolist(), strict=True))
    assert math.isnan(by_close[ms("09:20:00")])  # one 5m bar: not enough
    assert by_close[ms("09:25:00")] == 50.0  # (40 + 60) / 2 once the 09:20 bar closed
    assert by_close[ms("09:30:00")] == 75.0  # (50 + 100) / 2: 10,200 − 10,100 gap counts


def test_vwap_is_the_tick_average_price_at_the_bar_close() -> None:
    tape = [T("09:15:10", 10_000, vwap=9_990), T("09:15:50", 10_010, vwap=9_995), T("09:16:30", 1)]
    stock = stock_day("INFY", tape)
    context = build_context(stock.bars1, stock.bars5, History(), SIGNAL)
    assert context.vwap[0] == 9_995 and math.isnan(context.vwap[1])  # 0 = none


def test_upward_context_and_range_condition() -> None:
    rising = [
        T(f"{9 + (15 + 5 * k) // 60:02d}:{(15 + 5 * k) % 60:02d}:30", 10_000 + 10 * k, vwap=9_900)
        for k in range(30)
    ]
    stock = stock_day("INFY", rising)
    signal = SIGNAL.model_copy(update={"context_ema_period": 3, "atr_period": 2})
    context = build_context(stock.bars1, stock.bars5, History(), signal)
    last = len(stock.bars1) - 1
    assert context.upward(last) is True  # close > VWAP 99.00, > EMA, EMA rising
    below = [T(t.at, t.ltp, vwap=20_000) for t in rising]
    stock_b = stock_day("INFY", below)
    assert build_context(stock_b.bars1, stock_b.bars5, History(), signal).upward(last) is False
    assert context.upward(0) is None  # no EMA yet
    flat = stock_day("INFY", minute_tape("09:15:00", "10:00:00", 10_000, spread=4))
    calm = build_context(flat.bars1, flat.bars5, History(EARLIER), SIGNAL)
    assert calm.in_range(len(flat.bars1) - 1, SIGNAL.range_span_atr) is True
    assert calm.prev_high == 10_050 and calm.prev_low == 9_950
    assert calm.sources == frozenset({"atr", "volume_baseline", "prev_day"})


def test_relative_volume_guide_case() -> None:
    # Baseline 1,000 shares a minute over 20 sessions; at 10:00 (minute 45) the day has traded
    # 52,800 since 09:16: 52,800 ÷ 44,000 = 1.2.
    tape = [T("09:15:30", 10_000, volume=7_000), T("09:59:30", 10_000, volume=59_800)]
    stock = stock_day("INFY", tape)
    context = build_context(stock.bars1, stock.bars5, History(EARLIER), SIGNAL)
    at_ten = list(stock.bars1.end).index(ms("10:00:00"))
    assert round(float(context.rel_volume[at_ten]), 6) == 1.2
    short = build_context(stock.bars1, stock.bars5, History(EARLIER[:19]), SIGNAL)
    assert math.isnan(short.rel_volume[at_ten])  # 19 sessions < 20: warm-up, not a guess


def test_cumulative_volume_leaves_out_the_first_minute() -> None:
    open_ms, _ = session_ms(DAY)
    start = np.array([open_ms, open_ms + 60_000, open_ms + 180_000], dtype=np.int64)
    out = cumulative_volume(start, np.array([500, 10, 20], dtype=np.int64), open_ms)
    assert out[:5].tolist() == [0, 10, 10, 30, 30]


def test_signal_checks_name_every_failure() -> None:
    flat = stock_day("INFY", minute_tape("09:15:00", "10:00:00", 10_000, spread=4))
    gate = IndexGate(default_research_settings().market, None, None, session_ms(DAY)[0])
    nothing = build_context(flat.bars1, flat.bars5, History(), SIGNAL)
    checks = SignalChecks(SIGNAL, {"INFY": nothing}, gate)
    i = len(flat.bars1) - 1
    trend = Candidate(ms("10:00:00"), "INFY", "x", "trend", i, 10_000, 9_900, target_r=2.0)
    assert checks.reasons(trend, 10_005) == ["market_gate", "warmup"]  # no index, no warm-up
    warm = build_context(flat.bars1, flat.bars5, History(EARLIER), SIGNAL)
    off = IndexGate(
        default_research_settings().market.model_copy(update={"market_gate": False}),
        None,
        None,
        session_ms(DAY)[0],
    )
    checks = SignalChecks(SIGNAL, {"INFY": warm}, off)
    atr = float(warm.atr[i])
    reclaim = Candidate(
        ms("10:00:00"),
        "INFY",
        "x",
        "range",
        i,
        10_000,
        10_000 - round(3 * atr),
        target=10_010,
        min_reward_r=2.0,
    )
    assert checks.reasons(reclaim, 10_000) == ["relative_volume", "stop_too_wide", "reward_room"]
    narrow = Candidate(ms("10:00:00"), "INFY", "x", "range", i, 10_000, 9_999, target_r=2.0)
    assert "stop_too_narrow" in checks.reasons(narrow, 10_000)
    assert checks.fits_at_fill(narrow, 10_000) is False


def test_warmup_prefers_recorded_days_then_kite_candles(
    factory: sessionmaker[Session], clean: Engine, tmp_path: Path
) -> None:
    from intraday_factory import insert_history_days, insert_ticks

    recorded_day, candle_days = date(2026, 9, 30), [date(2026, 9, 28), date(2026, 9, 29)]
    with factory() as db:
        insert_ticks(db, "INFY", minute_tape("09:15:00", "09:20:00", 10_000), recorded_day)
        insert_history_days(db, "INFY", [*candle_days, recorded_day], price=20_000)
        warmup = Warmup(db, tmp_path, DAY, DAY, sessions=5)
        history = warmup.history("INFY", DAY)
        db.rollback()
    assert [s.source for s in history.sessions] == ["history", "history", "recorded"]
    assert int(history.sessions[-1].close[-1]) == 10_000  # the recorded ticks, not the candles
    assert len(history.sessions[-1]) == 5
