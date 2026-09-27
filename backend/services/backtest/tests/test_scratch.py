"""NOVA-110 (D61): the per-run scratch folder."""

from datetime import datetime, timedelta
from pathlib import Path

import numpy as np
from nova_backtest.bars import IST, Bar
from nova_backtest.columns import Columns
from nova_backtest.scratch import RunScratch, clear_all

DAY0 = datetime(2026, 1, 5, tzinfo=IST)


def test_scratch_round_trips_and_goes_away(tmp_path: Path) -> None:
    bars = [Bar(DAY0 + timedelta(days=i), 100, 110, 90, 105, 7) for i in range(3)]
    scratch = RunScratch(tmp_path, "run_x")
    yes = np.ones(3, dtype=np.bool_)
    scratch.add("M&M", Columns.from_bars(bars), yes, ~yes)
    none = np.zeros(0, dtype=np.bool_)
    scratch.add("NIFTY 50", Columns.from_bars([]), none, none)

    assert scratch.symbols() == ["M&M", "NIFTY 50"]
    assert scratch.series("M&M").columns.to_bars() == bars
    assert scratch.series("M&M").enter.tolist() == [True] * 3
    assert scratch.series("M&M").exit.tolist() == [False] * 3
    assert len(scratch.series("NIFTY 50").columns) == 0  # empty arrays load without a memory map
    scratch.close()
    assert not (tmp_path / "run_x").exists()


def test_clear_all_removes_folders_left_by_a_stopped_worker(tmp_path: Path) -> None:
    (tmp_path / "run_crashed" / "00000").mkdir(parents=True)
    (tmp_path / "run_crashed" / "00000" / "ts.npy").write_bytes(b"x")
    clear_all(tmp_path)
    assert list(tmp_path.iterdir()) == []
    clear_all(tmp_path / "missing")  # a first start has no folder yet
