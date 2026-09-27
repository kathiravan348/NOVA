"""NOVA-115 (D62): ranked buys, trailing / ATR / bars-held exits. Prices in rupees."""

import math
from datetime import datetime, time, timedelta

from nova_backtest.bars import IST, Bar
from nova_backtest.simulate import Simulation, simulate_bars
from nova_contracts import Charges, Sizing
from nova_contracts.strategy import AtrStop, Portfolio, Risk
from pydantic import TypeAdapter

DAY0 = datetime.combine(datetime(2026, 9, 1).date(), time(0), tzinfo=IST)
ONE = TypeAdapter[Sizing](Sizing).validate_python({"type": "fixed_qty", "qty": 1})
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
NAN = math.nan


def _bars(*ohlc: tuple[float, float, float, float]) -> list[Bar]:
    return [
        Bar(
            DAY0 + timedelta(days=i),
            round(o * 100),
            round(h * 100),
            round(lo * 100),
            round(c * 100),
            1,
        )
        for i, (o, h, lo, c) in enumerate(ohlc)
    ]


class _EnterFirst:
    """Wants in at the first close only; never asks to leave."""

    def enter(self, symbol: str, i: int) -> bool:
        return i == 0

    def exit(self, symbol: str, i: int) -> bool:
        return False


def _run(
    bars: dict[str, list[Bar]],
    risk: Risk,
    portfolio: Portfolio | None = None,
    ranks: dict[str, list[float]] | None = None,
    atrs: dict[str, list[float]] | None = None,
) -> Simulation:
    return simulate_bars(
        bars,
        _EnterFirst(),
        ONE,
        risk,
        10_000_000,
        DAY0,
        lambda *_: ZERO,
        portfolio=portfolio,
        ranks=ranks,
        atrs=atrs,
    )


def _portfolio(order: str) -> Portfolio:
    return Portfolio.model_validate(
        {"maxPositions": 2, "rank": {"by": {"kind": "price", "field": "close"}, "order": order}}
    )


FLAT = _bars(*[(100, 100, 100, 100)] * 3)
NO_RISK = Risk(stop_loss_percent=None, target_percent=None)


def _bought(result: Simulation) -> list[str]:
    return sorted(t.symbol for t in result.trades)


def test_the_best_ranked_buys_fill_the_free_slots() -> None:
    bars = {"ABB": FLAT, "INFY": FLAT, "TCS": FLAT}
    ranks = {"ABB": [5.0] * 3, "INFY": [NAN] * 3, "TCS": [9.0] * 3}

    assert _bought(_run(bars, NO_RISK, _portfolio("desc"), ranks)) == ["ABB", "TCS"]
    ranks["INFY"] = [7.0] * 3
    assert _bought(_run(bars, NO_RISK, _portfolio("asc"), ranks)) == ["ABB", "INFY"]
    unranked = {"ABB": [NAN] * 3, "INFY": [NAN] * 3, "TCS": [1.0] * 3}
    assert _bought(_run(bars, NO_RISK, _portfolio("desc"), unranked)) == ["ABB", "TCS"]  # NaN last


def test_without_a_rank_slots_fill_in_symbol_order() -> None:
    bars = {"ABB": FLAT, "INFY": FLAT, "TCS": FLAT}
    plain = Portfolio.model_validate({"maxPositions": 2})
    assert _bought(_run(bars, NO_RISK, plain)) == ["ABB", "INFY"]
    assert _bought(_run(bars, NO_RISK)) == ["ABB", "INFY", "TCS"]  # no portfolio: no limit


def test_a_trailing_stop_rises_never_falls_and_fills_at_a_gap_open() -> None:
    bars = _bars(
        (100, 100, 100, 100),  # signal
        (100, 100, 85, 100),  # bought at 100; below 90 but no level before this close → held
        (100, 121, 91, 120),  # level 90 holds; the close sets it to 108
        (118, 119, 109, 110),  # level stays 108 (highest close 120)
        (100, 101, 99, 100),  # gap below 108 → out at the open, 100
    )
    risk = Risk(stop_loss_percent=None, target_percent=None, trailing_stop_percent=10)

    (trade,) = _run({"INFY": bars}, risk).trades

    assert (trade.entry_price, trade.exit_price) == (10_000, 10_000)
    assert trade.exit_at == DAY0 + timedelta(days=4)


def test_an_atr_level_only_moves_up() -> None:
    bars = _bars(
        (100, 100, 100, 100),
        (100, 100, 100, 100),  # bought; close 100 − 2 × 5 = 90
        (100, 100, 91, 100),  # ATR 10 would give 80: the level stays 90
        (95, 95, 89, 92),  # low 89 ≤ 90 → out at 90
    )
    risk = Risk(
        stop_loss_percent=None, target_percent=None, atr_stop=AtrStop(period=5, multiplier=2)
    )

    (trade,) = _run({"INFY": bars}, risk, atrs={"INFY": [NAN, 5.0, 10.0, 10.0]}).trades

    assert trade.exit_price == 9_000 and trade.exit_at == DAY0 + timedelta(days=3)


def test_a_higher_fixed_stop_wins() -> None:
    bars = _bars((100, 100, 100, 100), (100, 100, 100, 100), (100, 100, 94, 96))
    risk = Risk(stop_loss_percent=5, target_percent=None, trailing_stop_percent=10)

    (trade,) = _run({"INFY": bars}, risk).trades

    assert trade.exit_price == 9_500  # the 95 stop, not the 90 trailing level


def test_max_hold_bars_exits_at_the_open_after_the_nth_close() -> None:
    bars = _bars(*[(100 + i, 100 + i, 100 + i, 100 + i) for i in range(7)])
    risk = Risk(stop_loss_percent=None, target_percent=None, max_hold_bars=3)

    trade = _run({"INFY": bars}, risk).trades[0]

    # Bought at bar 1's open; held bars 1, 2, 3; out at bar 4's open.
    assert (trade.entry_price, trade.exit_price) == (10_100, 10_400)
    assert trade.exit_at == DAY0 + timedelta(days=4)
