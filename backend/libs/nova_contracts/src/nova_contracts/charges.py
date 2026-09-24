"""Charges: mirrors `frontend/packages/contracts/src/charges.ts`."""

from typing import Self

from pydantic import model_validator

from nova_contracts.common import Contract, NonNegPaise


class Charges(Contract):
    brokerage_paise: NonNegPaise
    stt_paise: NonNegPaise
    exchange_txn_paise: NonNegPaise
    sebi_fee_paise: NonNegPaise
    stamp_duty_paise: NonNegPaise
    gst_paise: NonNegPaise
    dp_paise: NonNegPaise
    total_paise: NonNegPaise

    @model_validator(mode="after")
    def _total(self) -> Self:
        parts = (
            self.brokerage_paise
            + self.stt_paise
            + self.exchange_txn_paise
            + self.sebi_fee_paise
            + self.stamp_duty_paise
            + self.gst_paise
            + self.dp_paise
        )
        if self.total_paise != parts:
            raise ValueError("totalPaise must equal the sum of individual charges")
        return self
