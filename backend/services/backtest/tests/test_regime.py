"""NOVA-117 (D62 (3)): the market filter on the index's own prices, in visual/Python mode."""

from datetime import datetime, time, timedelta

import numpy as np
from nova_backtest.bars import IST, Bar
from nova_backtest.columns import Columns
from nova_backtest.regime import RegimeSeries
from nova_backtest.simulate import Simulation, WhenOff, simulate_bars
from nova_contracts import Charges, Sizing
from nova_contracts.strategy import Regime, Risk
from pydantic import TypeAdapter

DAY0 = datetime.combine(datetime(2025, 1, 1).date(), time(0), tzinfo=IST)
ZERO = Charges(
    brokerage_paise=0,
    stt_paise=0,
    exchange_txn_paise=0,
    sebi_fee_paise=0,
    stamp_duty_paise=0,
    gst_paise=0,
    dp_paise=0,
    total_paise=0,
)
ONE = TypeAdapter[Sizing](Sizing).validate_python({"type": "fixed_qty", "qty": 1})
ABOVE_SMA = Regime.model_validate(
    {
        "index": "NIFTY 50",
        "condition": {
            "left": {"kind": "price", "field": "close"},
            "op": "gt",
            "right": {"kind": "indicator", "name": "sma", "params": {"period": 3}},
        },
        "whenOff": "exit_all",
    }
)
# Index closes: rising, a dip below its 3-bar SMA on bars 5–6, then rising again.
INDEX = [100, 101, 102, 103, 104, 95, 94, 99, 105, 106, 107, 108]


def _series(closes: list[int], hour: int = 0) -> list[Bar]:
    return [
        Bar(DAY0 + timedelta(days=i, hours=hour), c * 100, c * 100, c * 100, c * 100, 1)
        for i, c in enumerate(closes)
    ]


def _filter() -> RegimeSeries:
    return RegimeSeries.from_columns(ABOVE_SMA, Columns.from_bars(_series(INDEX)))


def test_the_filter_is_the_last_index_bar_at_or_before_each_time() -> None:
    regime = _filter()
    assert regime.on.tolist() == [
        False,
        False,
        True,
        True,
        True,
        False,
        False,
        True,
        True,
        True,
        True,
        True,
    ]

    # Stock bars an hour after each index bar see that day's value; one before the first sees off.
    stock = Columns.from_bars(_series(INDEX, hour=1))
    assert regime.at(stock.ts).tolist() == regime.on.tolist()
    early = np.array([int((DAY0 - timedelta(days=1)).timestamp())], dtype=np.int64)
    assert regime.at(early).tolist() == [False]


class _Always:
    """Wants to hold the stock all the time."""

    def enter(self, symbol: str, i: int) -> bool:
        return True

    def exit(self, symbol: str, i: int) -> bool:
        return False


def _run(when_off: WhenOff) -> Simulation:
    bars = _series([100] * len(INDEX))
    market = _filter().at(Columns.from_bars(bars).ts).tolist()
    return simulate_bars(
        {"INFY": bars},
        _Always(),
        ONE,
        Risk(stop_loss_percent=None, target_percent=None),
        1_000_000,
        DAY0,
        lambda *_: ZERO,
        regimes={"INFY": market},
        when_off=when_off,
    )


def _days(result: Simulation) -> list[tuple[int, int]]:
    return [((t.entry_at - DAY0).days, (t.exit_at - DAY0).days) for t in result.trades]


def test_exit_all_sells_at_the_open_after_the_filter_turns_off_and_buys_after_it_recovers() -> None:
    # Filter on from bar 2 → bought at bar 3; off at bar 5's close → sold at bar 6's open;
    # on again at bar 7's close → bought at bar 8; the last bar closes the run.
    assert _days(_run("exit_all")) == [(3, 6), (8, 11)]


def test_no_new_entries_keeps_holdings() -> None:
    assert _days(_run("no_new_entries")) == [(3, 11)]
