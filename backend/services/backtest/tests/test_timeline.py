"""NOVA-110 (D61): timeline windows, D61 fill order, and the streaming simulator vs the oracle."""

import random
import sys
from datetime import date, datetime, time, timedelta
from pathlib import Path

import numpy as np
import pytest
from nova_backtest.bars import IST, Bar
from nova_backtest.columns import Columns
from nova_backtest.scratch import MemoryStore, RunScratch
from nova_backtest.simulate import simulate
from nova_backtest.timeline import walk
from nova_contracts import Charges, Sizing
from nova_contracts.strategy import Averaging, Risk
from pydantic import TypeAdapter

sys.path.insert(0, str(Path(__file__).parent))
from reference_simulate import reference_simulate  # noqa: E402

SIZING = TypeAdapter[Sizing](Sizing)
DAY0 = datetime(2026, 1, 5, tzinfo=IST)
NO_RISK = Risk(stop_loss_percent=None, target_percent=None)
NAMES = ["ABB", "INFY", "M&M", "NIFTY 50", "TCS", "ZEEL"]


def _charges(qty: int, entry: int, exit_: int, at: datetime) -> Charges:
    fee = (qty * (entry + exit_)) // 1000  # 0.1 %: charges follow the fills
    return Charges(
        brokerage_paise=fee,
        stt_paise=0,
        exchange_txn_paise=0,
        sebi_fee_paise=0,
        stamp_duty_paise=0,
        gst_paise=0,
        dp_paise=0,
        total_paise=fee,
    )


class _Flags:
    def __init__(self, flags: dict[str, list[tuple[bool, bool]]]) -> None:
        self.flags = flags

    def enter(self, symbol: str, i: int) -> bool:
        return self.flags[symbol][i][0]

    def exit(self, symbol: str, i: int) -> bool:
        return self.flags[symbol][i][1]


def _store(bars: dict[str, list[Bar]], flags: _Flags) -> MemoryStore:
    return MemoryStore.from_bars(bars, flags)


def test_the_timeline_groups_equal_times_in_symbol_order_across_windows() -> None:
    bars = {
        symbol: [Bar(DAY0 + timedelta(days=d), 1, 1, 1, 1, 1) for d in days]
        for symbol, days in (("TCS", [0, 1, 3]), ("INFY", [1, 2, 3]))
    }
    store = _store(bars, _Flags({s: [(False, False)] * 3 for s in bars}))
    for window in (1, 2, 1000):
        groups = [[(b.symbol, b.i) for b in group] for _, group in walk(store, window)]
        assert groups == [
            [("TCS", 0)],
            [("INFY", 0), ("TCS", 1)],
            [("INFY", 1)],
            [("INFY", 2), ("TCS", 2)],
        ]


def test_a_same_morning_sell_pays_for_a_buy_d61() -> None:
    """ZEEL's sell fills at the open before ABB's buy there, although ABB sorts first."""
    bars = {
        s: [Bar(DAY0 + timedelta(days=i), 10_000, 10_000, 10_000, 10_000, 1) for i in range(3)]
        for s in ("ABB", "ZEEL")
    }
    none = (False, False)
    flags = _Flags(
        {"ABB": [none, (True, False), none], "ZEEL": [(True, False), (False, True), none]}
    )
    sizing = SIZING.validate_python({"type": "fixed_qty", "qty": 100})

    result = simulate(_store(bars, flags), sizing, NO_RISK, 1_500_000, DAY0, _charges)

    assert [(t.symbol, t.entry_at.astimezone(IST).day) for t in result.trades] == [
        ("ZEEL", 6),
        ("ABB", 7),
    ]


def _series(rng: random.Random, times: list[datetime]) -> list[Bar]:
    bars: list[Bar] = []
    close = rng.randint(5_000, 100_000)
    for ts in times:
        if rng.random() < 0.15:  # a missing bar
            continue
        gap = rng.choice([0.0, 0.0, 0.0, rng.gauss(0, 0.08)])  # sometimes the open jumps
        open_ = max(100, round(close * (1 + gap + rng.gauss(0, 0.01))))
        close = max(100, round(open_ * (1 + rng.gauss(0, 0.03))))
        high = round(max(open_, close) * (1 + rng.random() * 0.03))
        low = max(50, round(min(open_, close) * (1 - rng.random() * 0.03)))
        bars.append(Bar(ts, open_, high, low, close, rng.randint(1, 10_000)))
    return bars


def _times(rng: random.Random, intraday: bool) -> list[datetime]:
    days = [DAY0 - timedelta(days=3) + timedelta(days=d) for d in range(rng.randint(6, 30))]
    days = [d for d in days if d.weekday() < 5 and rng.random() > 0.1]  # weekends and holidays
    if not intraday:
        return days
    start = datetime.combine(date(2026, 1, 1), time(15, 0)) - timedelta(minutes=rng.randint(0, 10))
    minutes = rng.randint(15, 30)
    return [
        datetime.combine(d.date(), (start + timedelta(minutes=m)).time(), tzinfo=IST)
        for d in days
        for m in range(minutes)
    ]


def _sizing(rng: random.Random) -> Sizing:
    kind = rng.choice(["fixed_qty", "fixed_amount", "percent_equity"])
    if kind == "fixed_qty":
        return SIZING.validate_python({"type": kind, "qty": rng.randint(1, 50)})
    if kind == "fixed_amount":
        return SIZING.validate_python({"type": kind, "amount_paise": rng.randint(10_000, 900_000)})
    return SIZING.validate_python({"type": kind, "percent": rng.choice([10, 25, 50, 100])})


@pytest.mark.parametrize("seed", range(200))
def test_streaming_simulate_matches_the_reference(seed: int, tmp_path: Path) -> None:
    rng = random.Random(seed)
    intraday = rng.random() < 0.4
    times = _times(rng, intraday)
    names = sorted(rng.sample(NAMES, rng.randint(1, 6)))
    bars = {s: _series(rng, times) for s in names}
    chance = rng.choice([0.05, 0.2, 0.5])
    flags = _Flags(
        {s: [(rng.random() < chance, rng.random() < chance) for _ in b] for s, b in bars.items()}
    )
    sizing = _sizing(rng)
    risk = Risk(
        stop_loss_percent=rng.choice([None, 2.0, 5.0]),
        target_percent=rng.choice([None, 3.0, 8.0]),
    )
    averaging = rng.choice([None, Averaging(drop_percent=rng.choice([1.0, 3.0]), max_adds=3)])
    cash = rng.choice([300_000, 2_000_000, 10_000_000])  # small cash drops buys
    square_off = time(15, 20) if intraday else None
    args = (sizing, risk, cash, DAY0, _charges, square_off, averaging)

    expected = reference_simulate(bars, flags, *args)
    scratch = RunScratch(tmp_path, "run")
    try:
        for s, series in bars.items():
            count = range(len(series))
            scratch.add(
                s,
                Columns.from_bars(series),
                np.array([flags.enter(s, i) for i in count], dtype=np.bool_),
                np.array([flags.exit(s, i) for i in count], dtype=np.bool_),
            )
        actual = simulate(scratch, *args, window_bars=7)  # tiny windows cross chunk edges
    finally:
        scratch.close()

    assert actual.trades == expected.trades
    assert actual.equity == expected.equity
