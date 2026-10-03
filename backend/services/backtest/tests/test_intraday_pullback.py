from typing import Any

import pytest
from intraday_factory import (
    Ohlc,
    bar_tape,
    flat_minutes,
    live_replay,
    stock_day,
    with_context,
)
from nova_backtest.intraday.replay import _valid_at_fill
from nova_backtest.intraday.setups import Candidate, factory_for
from nova_contracts import IntradaySetup
from pydantic import TypeAdapter

SETUP: TypeAdapter[IntradaySetup] = TypeAdapter(IntradaySetup)
PULLBACK = {"kind": "vwap_trend_pullback", "proximityAtr": 0.3, "risingBars": 3,
            "expiryBars": 3, "targetR": 2}  # fmt: skip
RECLAIM = {"kind": "failed_breakout_reclaim", "reclaimBars": 3, "minRewardR": 2, "exit": "vwap"}


def found(
    minutes: list[Ohlc],
    setup: dict[str, Any],
    vwaps: dict[str, int] | int = 0,
    **context: Any,
) -> list[Candidate]:
    stock = with_context(stock_day("INFY", bar_tape(minutes, vwap=vwaps)), **context)
    spec = SETUP.validate_python(setup)
    machine = factory_for(spec)(spec, stock)
    return [c for c in (machine.on_bar(i) for i in range(len(stock.bars1))) if c is not None]


# 09:15–09:29 at ₹101 ± 0.10, the session VWAP rising ₹99.80 → ₹99.94 (5m: 99.84 < 99.89 < 99.94).
WARM: list[Ohlc] = flat_minutes("09:15", "09:30", 10_100, half=10)
RISING = {f"09:{15 + k}": 9_980 + k for k in range(15)}


def test_vwap_pullback_guide_example() -> None:
    # VWAP ~₹100, ATR ₹1: a pullback low ₹99.75 is within ₹0.30; the next close above its high.
    minutes = WARM + [("09:30", 10_010, 10_030, 9_975, 10_020), ("09:31", 10_020, 10_045, 10_010,
                                                                10_040)]  # fmt: skip
    (candidate,) = found(minutes, PULLBACK, RISING, atr=100.0, vwap=10_000)
    assert (candidate.stop, candidate.family, candidate.price) == (9_975, "trend", 10_040)
    assert 10_040 - candidate.stop == 65  # a fill at ₹100.40 risks ₹0.65 a share
    assert candidate.target_at(10_040) == 10_040 + 130


def test_vwap_pullback_negative_cases() -> None:
    minutes = WARM + [("09:30", 10_010, 10_030, 9_975, 10_020), ("09:31", 10_020, 10_045, 10_010,
                                                                10_040)]  # fmt: skip
    flat = dict.fromkeys(RISING, 9_990)
    assert found(minutes, PULLBACK, flat, atr=100.0, vwap=10_000) == []  # VWAP not rising
    far = found(minutes, PULLBACK, RISING, atr=50.0, vwap=10_000)  # ±₹0.15: ₹99.75 is too far
    assert far == []
    # Three bars that neither confirm nor touch the VWAP band, then a close above: too late.
    late = WARM + [("09:30", 10_010, 10_030, 9_975, 10_020)]
    late += [(f"09:3{m}", 10_000, 10_020, 9_960, 10_000) for m in (1, 2, 3)]
    late += [("09:34", 10_020, 10_045, 10_010, 10_040)]
    assert found(late, PULLBACK, RISING, atr=100.0, vwap=10_000) == []


def test_reclaim_guide_example_and_reward_room() -> None:
    # Previous low ₹100; a low of ₹98.80, then a close back above → stop ₹98.80, target VWAP ₹103.
    minutes = WARM + [("09:30", 9_990, 9_995, 9_880, 9_950), ("09:31", 9_950, 10_030, 9_940,
                                                              10_020)]  # fmt: skip
    (candidate,) = found(minutes, RECLAIM, atr=100.0, prev_low=10_000, vwap=10_300)
    assert (candidate.stop, candidate.target, candidate.family) == (9_880, 10_300, "range")
    assert _valid_at_fill(candidate, 10_020) is True  # 2.80 = exactly 2R of 1.40
    assert _valid_at_fill(candidate, 10_030) is False  # 2.70 < 2R of 1.50


def test_reclaim_negative_cases_and_range_mid() -> None:
    intrabar = WARM + [("09:30", 9_990, 10_020, 9_880, 10_010)]
    intrabar += [(f"09:3{m}", 9_995, 10_000, 9_990, 9_995) for m in (1, 2, 3)]
    assert found(intrabar, RECLAIM, atr=100.0, prev_low=10_000, vwap=10_300) == []
    late = WARM + [("09:30", 9_990, 9_995, 9_880, 9_950)]
    late += [(f"09:3{m}", 9_950, 9_990, 9_940, 9_960) for m in (1, 2, 3)]
    late += [("09:34", 9_960, 10_030, 9_950, 10_020)]
    assert found(late, RECLAIM, atr=100.0, prev_low=10_000, vwap=10_300) == []
    assert found(late, RECLAIM, atr=100.0, prev_low=None, vwap=10_300) == []
    middle = RECLAIM | {"exit": "range_mid"}
    minutes = WARM + [("09:30", 9_990, 9_995, 9_880, 9_950), ("09:31", 9_950, 10_030, 9_940,
                                                              10_020)]  # fmt: skip
    (candidate,) = found(minutes, middle, atr=100.0, prev_low=10_000)
    assert candidate.target == 10_100  # opening range ₹100.90–₹101.10


def rising(start: str, end: str, first: int, step: int = 2, half: int = 10) -> list[Ohlc]:
    bars = flat_minutes(start, end, 0)
    return [(c, first + k * step, first + k * step + half, first + k * step - half,
             first + k * step) for k, (c, *_r) in enumerate(bars)]  # fmt: skip


SCENARIOS: dict[str, tuple[dict[str, Any], list[Ohlc], Any]] = {
    "vwap_trend_pullback": (
        PULLBACK,
        rising("09:15", "09:40", 10_020)
        + [("09:40", 10_070, 10_075, 10_035, 10_065), ("09:41", 10_070, 10_090, 10_060, 10_085)]
        + rising("09:42", "09:55", 10_100, step=20)
        + flat_minutes("09:55", "15:30", 10_400, half=5),
        lambda price: price - 25,
    ),
    "failed_breakout_reclaim": (
        RECLAIM,
        flat_minutes("09:15", "09:40", 10_000, half=10)
        + [("09:40", 9_990, 9_995, 9_910, 9_940), ("09:41", 9_945, 9_965, 9_935, 9_962)]
        + rising("09:42", "09:55", 9_980, step=10)
        + flat_minutes("09:55", "15:30", 10_100, half=5),
        10_080,
    ),
}


@pytest.mark.parametrize("kind", list(SCENARIOS))
def test_each_setup_trades_end_to_end_with_single_buying(kind: str) -> None:
    setup, minutes, vwap = SCENARIOS[kind]
    run = live_replay({"INFY": bar_tape(minutes, vwap=vwap)}, setup)
    filled = [d for d in run.decisions if d.outcome != "skipped"]
    assert len(filled) == 1, [(d.at_ms, d.reasons) for d in run.decisions]
    (position,) = run.closed
    assert position.exit_reason == "target" and position.candidate.setup == kind
    assert position.trade().net > 0


def test_the_range_gate_applies_to_reclaim() -> None:
    setup, minutes, vwap = SCENARIOS["failed_breakout_reclaim"]
    run = live_replay({"INFY": bar_tape(minutes, vwap=vwap)}, setup, market_gate=True)
    assert run.closed == [] and run.decisions[0].first_reason == "market_gate"
