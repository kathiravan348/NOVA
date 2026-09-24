"""Charges for one trade (D17, D42): Decimal maths on paise, rounded per component."""

from decimal import ROUND_HALF_UP, Decimal
from typing import Literal

from nova_contracts import Charges

from nova_ledger.rates import ChargeRates

Side = Literal["buy", "sell"]
PAISE_PER_CRORE = Decimal(10**9)  # ₹1 crore = 10^7 rupees = 10^9 paise
HUNDRED = Decimal(100)


def _paise(amount: Decimal) -> int:
    return int(amount.quantize(Decimal(1), rounding=ROUND_HALF_UP))


def _rupees(amount: Decimal) -> int:
    """STT is charged to the nearest rupee (contract notes); the result is still in paise."""
    return int((amount / HUNDRED).quantize(Decimal(1), rounding=ROUND_HALF_UP)) * 100


def trade_charges(
    rates: ChargeRates,
    side: Side,
    qty: int,
    entry_price_paise: int,
    exit_price_paise: int | None,
) -> Charges:
    """Charges of a trade's legs: `side` is the entry side; an open trade has only its entry leg."""
    entry = Decimal(qty * entry_price_paise)
    exit_ = Decimal(qty * exit_price_paise) if exit_price_paise is not None else None
    buys = [entry] if side == "buy" else ([exit_] if exit_ is not None else [])
    sells = [entry] if side == "sell" else ([exit_] if exit_ is not None else [])
    orders = buys + sells

    def brokerage(value: Decimal) -> Decimal:
        fee = value * rates.brokerage_percent / HUNDRED
        cap = rates.brokerage_max_per_order_paise
        return min(fee, cap) if cap is not None else fee

    turnover = sum(orders, Decimal(0))
    brokerage_total = sum((brokerage(v) for v in orders), Decimal(0))
    stt = (
        sum(buys, Decimal(0)) * rates.stt_buy_percent
        + sum(sells, Decimal(0)) * rates.stt_sell_percent
    ) / HUNDRED
    txn = turnover * rates.exchange_txn_percent / HUNDRED
    sebi = turnover * rates.sebi_per_crore_paise / PAISE_PER_CRORE
    stamp = sum(buys, Decimal(0)) * rates.stamp_buy_percent / HUNDRED
    dp = rates.dp_per_sell_paise * len(sells)
    gst = (brokerage_total + txn + sebi + dp) * rates.gst_percent / HUNDRED

    parts = {
        "brokerage_paise": _paise(brokerage_total),
        "stt_paise": _rupees(stt),
        "exchange_txn_paise": _paise(txn),
        "sebi_fee_paise": _paise(sebi),
        "stamp_duty_paise": _paise(stamp),
        "gst_paise": _paise(gst),
        "dp_paise": _paise(dp),
    }
    return Charges.model_validate(parts | {"total_paise": sum(parts.values())})
