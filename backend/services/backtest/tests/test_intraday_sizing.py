from decimal import Decimal

from nova_backtest.intraday.sizing import loss_at_stop, money_qty, risk_qty
from nova_ledger import ChargeRates, trade_charges

INTRADAY = ChargeRates(
    brokerage_percent=Decimal("0.03"),
    brokerage_max_per_order_paise=Decimal("2000"),
    stt_buy_percent=Decimal("0"),
    stt_sell_percent=Decimal("0.025"),
    exchange_txn_percent=Decimal("0.00297"),
    sebi_per_crore_paise=Decimal("1000"),
    stamp_buy_percent=Decimal("0.003"),
    gst_percent=Decimal("18"),
    dp_per_sell_paise=Decimal("0"),
)


def real(bought: int, sold: int) -> int:
    buy = trade_charges(INTRADAY, "buy", 1, bought, None).total_paise
    return buy + trade_charges(INTRADAY, "sell", 1, sold, None).total_paise


def none(_bought: int, _sold: int) -> int:
    return 0


def flat_100(_bought: int, _sold: int) -> int:
    return 10_000  # the guide's simplified ₹100 cost reserve


def test_guide_example_100_entry_98_stop_1000_risk() -> None:
    entry, stop, risk = 10_000, 9_800, 100_000
    assert risk_qty(entry, stop, risk, none) == 500
    assert risk_qty(entry, stop, risk, flat_100) == 450  # guide ch. 16 with a ₹100 reserve
    qty = risk_qty(entry, stop, risk, real)
    assert 450 < qty < 500  # real charges (about ₹50 here) cost fewer shares than none
    assert loss_at_stop(qty, entry, stop, real) <= risk < loss_at_stop(qty + 1, entry, stop, real)


def test_charges_are_searched_not_divided_out() -> None:
    # Brokerage caps at ₹20 an order: a constant cost per share would undersize large orders.
    entry, stop, risk = 50_000, 49_900, 1_000_000
    qty = risk_qty(entry, stop, risk, real)
    one_share = real(entry, stop)
    per_share_guess = risk // (entry - stop + one_share)
    assert qty > per_share_guess
    assert loss_at_stop(qty, entry, stop, real) <= risk


def test_no_room_or_no_stop_distance_gives_zero_and_money_rooms_cut() -> None:
    assert risk_qty(10_000, 10_000, 100_000, none) == 0
    assert risk_qty(10_000, 9_800, 0, none) == 0
    assert risk_qty(10_000, 9_800, 199, none) == 0
    assert money_qty(10_000, 1_500_000) == 150  # a ₹15,000 room at ₹100
    assert money_qty(10_000, -5) == 0
