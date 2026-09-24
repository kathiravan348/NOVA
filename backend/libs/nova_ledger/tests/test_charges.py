"""Hand-worked Zerodha examples (rates effective 2024-10-01, migration 0003)."""

from decimal import Decimal

import pytest
from nova_ledger import ChargeRates, trade_charges

DELIVERY = ChargeRates(
    brokerage_percent=Decimal("0"),
    brokerage_max_per_order_paise=None,
    stt_buy_percent=Decimal("0.1"),
    stt_sell_percent=Decimal("0.1"),
    exchange_txn_percent=Decimal("0.00297"),
    sebi_per_crore_paise=Decimal("1000"),
    stamp_buy_percent=Decimal("0.015"),
    gst_percent=Decimal("18"),
    dp_per_sell_paise=Decimal("1300"),
)
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


def test_delivery_round_trip() -> None:
    """100 @ ₹1,000 → ₹1,100: STT ₹210, txn ₹6.237, SEBI ₹0.21, stamp ₹15, DP ₹13, GST."""
    charges = trade_charges(DELIVERY, "buy", 100, 100_000, 110_000)

    assert charges.model_dump(by_alias=False) == {
        "brokerage_paise": 0,
        "stt_paise": 21_000,
        "exchange_txn_paise": 624,
        "sebi_fee_paise": 21,
        "stamp_duty_paise": 1_500,
        "gst_paise": 350,
        "dp_paise": 1_300,
        "total_paise": 24_795,
    }


def test_intraday_round_trip_caps_brokerage_per_order() -> None:
    """100 @ ₹1,000 → ₹1,010: brokerage 2 × ₹20, STT ₹25.25 → ₹25, GST 18% of ₹46.1707."""
    charges = trade_charges(INTRADAY, "buy", 100, 100_000, 101_000)

    assert charges.model_dump(by_alias=False) == {
        "brokerage_paise": 4_000,
        "stt_paise": 2_500,
        "exchange_txn_paise": 597,
        "sebi_fee_paise": 20,
        "stamp_duty_paise": 300,
        "gst_paise": 831,
        "dp_paise": 0,
        "total_paise": 8_248,
    }


def test_short_intraday_charges_the_same_legs() -> None:
    long = trade_charges(INTRADAY, "buy", 100, 100_000, 101_000)
    short = trade_charges(INTRADAY, "sell", 100, 101_000, 100_000)

    assert short == long


def test_small_orders_pay_percentage_brokerage() -> None:
    charges = trade_charges(INTRADAY, "buy", 10, 50_000, 50_000)  # ₹5,000 per order → ₹1.50 each

    assert charges.brokerage_paise == 300


def test_open_trade_has_only_its_entry_leg() -> None:
    charges = trade_charges(DELIVERY, "buy", 100, 100_000, None)

    assert charges.stt_paise == 10_000 and charges.stamp_duty_paise == 1_500
    assert charges.dp_paise == 0
    assert charges.total_paise == 10_000 + 297 + 10 + 1_500 + 55


@pytest.mark.parametrize("qty", [1, 7, 333, 10_000])
def test_total_is_always_the_sum_of_parts(qty: int) -> None:
    charges = trade_charges(DELIVERY, "buy", qty, 123_457, 131_311)

    parts = charges.model_dump(by_alias=False)
    assert parts.pop("total_paise") == sum(parts.values())
