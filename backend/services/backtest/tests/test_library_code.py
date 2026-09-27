"""NOVA-121: the library's Python strategies (family D) pass the sandbox check and run."""

import json
import math
from datetime import datetime, time, timedelta
from pathlib import Path

import pytest
from nova_backtest.bars import IST, Bar
from nova_backtest.columns import Columns
from nova_backtest.sandbox import ENTER, EXIT, check_code, run_python_one

D_FILE = Path(__file__).parents[2] / "strategy/src/nova_strategy/library/d_patterns.json"
ENTRIES = json.loads(D_FILE.read_text(encoding="utf-8"))


def _bars(count: int = 300) -> Columns:
    """Weekday daily bars at 00:00 IST: a rising wave with volume swings (paise)."""
    bars: list[Bar] = []
    day = datetime.combine(datetime(2024, 1, 1).date(), time(0), tzinfo=IST)
    k = 0
    while len(bars) < count:
        if day.weekday() < 5:
            close = 10_000 + 20 * k + round(600 * math.sin(k / 7))
            high = close + 80 + 40 * (k % 5)
            low = close - 80 - 30 * (k % 3)
            open_ = close - round(50 * math.cos(k / 3))
            bars.append(
                Bar(day, open_, max(high, open_), min(low, open_), close, 1_000 + 300 * (k % 11))
            )
            k += 1
        day += timedelta(days=1)
    return Columns.from_bars(bars)


def test_there_are_six_python_strategies() -> None:
    assert [e["id"] for e in ENTRIES] == ["D01", "D02", "D03", "D04", "D05", "D06"]


@pytest.mark.parametrize("entry", ENTRIES, ids=[e["id"] for e in ENTRIES])
def test_each_passes_the_check_and_runs(entry: dict[str, object]) -> None:
    spec = entry["spec"]
    assert isinstance(spec, dict)
    code = spec["code"]
    assert isinstance(code, str)
    calls = check_code(code)
    columns = _bars()

    codes = run_python_one(code, "INFY", columns, calls)

    assert len(codes) == len(columns)
    assert set(codes.tolist()) <= {0, ENTER, EXIT}
