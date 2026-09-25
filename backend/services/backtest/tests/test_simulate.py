"""Hand-checked fills (D45). Bars are daily at 00:00 IST; prices below are rupees."""

from datetime import datetime, time, timedelta

import pytest
from nova_backtest.bars import IST, Bar
from nova_backtest.simulate import Simulation, simulate
from nova_contracts import Charges, RuleGroup, Sizing
from nova_contracts.strategy import Risk
from pydantic import TypeAdapter

DAY0 = datetime.combine(datetime(2026, 9, 1).date(), time(0), tzinfo=IST)
ENTRY = RuleGroup.model_validate(
    {
        "combinator": "all",
        "conditions": [
            {
                "left": {"kind": "price", "field": "close"},
                "op": "gt",
                "right": {"kind": "number", "value": 105},
            }
        ],
    }
)
EXIT = RuleGroup.model_validate(
    {
        "combinator": "all",
        "conditions": [
            {
                "left": {"kind": "price", "field": "close"},
                "op": "lt",
                "right": {"kind": "number", "value": 100},
            }
        ],
    }
)
TEN = TypeAdapter[Sizing](Sizing).validate_python({"type": "fixed_qty", "qty": 10})
NO_RISK = Risk(stop_loss_percent=None, target_percent=None)


def _bars(*ohlc: tuple[float, float, float, float]) -> list[Bar]:
    return [
        Bar(
            DAY0 + timedelta(days=i),
            round(o * 100),
            round(h * 100),
            round(lo * 100),
            round(c * 100),
            1_000,
        )
        for i, (o, h, lo, c) in enumerate(ohlc)
    ]


def _charges(total: int) -> Charges:
    return Charges(
        brokerage_paise=total,
        stt_paise=0,
        exchange_txn_paise=0,
        sebi_fee_paise=0,
        stamp_duty_paise=0,
        gst_paise=0,
        dp_paise=0,
        total_paise=total,
    )


def _run(
    bars: list[Bar],
    *,
    sizing: Sizing = TEN,
    risk: Risk = NO_RISK,
    cash: int = 10_000_000,
    start: datetime = DAY0,
    fee: int = 0,
) -> Simulation:
    return simulate(
        {"INFY": bars}, ENTRY, EXIT, sizing, risk, cash, start, lambda *_: _charges(fee)
    )


BASE = (
    (100, 101, 99, 100),  # day 0
    (104, 107, 103, 106),  # day 1: close 106 > 105 → enter next open
    (107, 108, 106, 107),  # day 2: buy 10 @ 107
    (105, 106, 98, 99),  # day 3: close 99 < 100 → exit next open
    (98, 99, 97, 98),  # day 4: sell @ 98
)


def test_decide_at_close_fill_at_next_open() -> None:
    result = _run(_bars(*BASE), fee=100)

    (trade,) = result.trades
    assert (trade.entry_at, trade.entry_price) == (DAY0 + timedelta(days=2), 10_700)
    assert (trade.exit_at, trade.exit_price) == (DAY0 + timedelta(days=4), 9_800)
    assert trade.gross == -9_000 and trade.net == -9_100
    assert [value for _, value in result.equity] == [
        10_000_000,
        10_000_000,
        10_000_000,  # bought at 107, marked at close 107
        9_992_000,  # marked at 99
        9_990_900,  # sold at 98, minus ₹1 charges
    ]


@pytest.mark.parametrize(
    ("day3", "exit_price"),
    [((105, 106, 100, 104), 10_165), ((95, 96, 94, 95), 9_500)],
    ids=["stop inside the bar", "gap below the stop"],
)
def test_stop_loss(day3: tuple[float, float, float, float], exit_price: int) -> None:
    risk = Risk(stop_loss_percent=5, target_percent=None)  # stop = 107 × 0.95 = 101.65

    result = _run(_bars(*BASE[:3], day3), risk=risk)

    assert result.trades[0].exit_price == exit_price
    assert result.trades[0].exit_at == DAY0 + timedelta(days=3)


@pytest.mark.parametrize(
    ("day3", "exit_price"),
    [((110, 120, 109, 111), 11_770), ((125, 126, 124, 125), 12_500)],
    ids=["target inside the bar", "gap above the target"],
)
def test_target(day3: tuple[float, float, float, float], exit_price: int) -> None:
    risk = Risk(stop_loss_percent=None, target_percent=10)  # target = 117.70

    result = _run(_bars(*BASE[:3], day3), risk=risk)

    assert result.trades[0].exit_price == exit_price


def test_stop_wins_when_both_are_hit_in_one_bar() -> None:
    risk = Risk(stop_loss_percent=5, target_percent=10)

    result = _run(_bars(*BASE[:3], (107, 120, 100, 110)), risk=risk)

    assert result.trades[0].exit_price == 10_165


def test_sizing_by_amount_and_equity() -> None:
    amount = TypeAdapter[Sizing](Sizing).validate_python(
        {"type": "fixed_amount", "amountPaise": 50_000}
    )
    half = TypeAdapter[Sizing](Sizing).validate_python({"type": "percent_equity", "percent": 50})

    assert _run(_bars(*BASE), sizing=amount).trades[0].qty == 4  # ₹500 / ₹107
    assert _run(_bars(*BASE), sizing=half, cash=100_000).trades[0].qty == 4  # ₹500 / ₹107


def test_entry_is_skipped_without_enough_cash() -> None:
    assert _run(_bars(*BASE), cash=100_000).trades == []  # 10 × ₹107 > ₹1,000


def test_open_position_closes_at_the_last_bar() -> None:
    (trade,) = _run(_bars(*BASE[:3], (108, 110, 107, 109))).trades

    assert trade.exit_at == DAY0 + timedelta(days=3) and trade.exit_price == 10_900


def test_bars_before_the_start_only_warm_up() -> None:
    result = _run(_bars(*BASE), start=DAY0 + timedelta(days=3))

    assert result.trades == []  # the day-1 signal fell before the period
    assert [day for day, _ in result.equity] == [
        (DAY0 + timedelta(days=3)).date(),
        (DAY0 + timedelta(days=4)).date(),
    ]
