"""Charge rates from `charge_rates` (D42): the newest row effective on a trade's date."""

from datetime import date
from decimal import Decimal

from nova_db.models import ChargeRate
from pydantic import BaseModel, ConfigDict
from sqlalchemy import select
from sqlalchemy.orm import Session


class ChargeRates(BaseModel):
    """Percentages are of the trade value; paise amounts are per crore, per order or per sell."""

    model_config = ConfigDict(extra="forbid", frozen=True)

    brokerage_percent: Decimal
    brokerage_max_per_order_paise: Decimal | None
    stt_buy_percent: Decimal
    stt_sell_percent: Decimal
    exchange_txn_percent: Decimal
    sebi_per_crore_paise: Decimal
    stamp_buy_percent: Decimal
    gst_percent: Decimal
    dp_per_sell_paise: Decimal


def rates_for(db: Session, segment: str, day: date) -> ChargeRates:
    row = db.scalars(
        select(ChargeRate)
        .where(ChargeRate.segment == segment, ChargeRate.effective_from <= day)
        .order_by(ChargeRate.effective_from.desc())
        .limit(1)
    ).first()
    if row is None:
        raise LookupError(f"No {segment} charge rates effective on {day}")
    return ChargeRates.model_validate(row.rates)
