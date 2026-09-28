"""Charge rates for 2020-01-01 to 2024-09-30 (NOVA-129, D66): the 2024-10-01 schedule applied earlier.

An approximation (Owner choice 2026-09-28), like D62's tax at today's rates: until 2024-10-01 NSE's
transaction charge was slightly higher; STT, stamp duty and GST were the same. Backtests before
2024-10-01 failed with "No … charge rates effective on …" without these rows.

Revision ID: 0019
Revises: 0018
Create Date: 2026-09-28
"""

from collections.abc import Sequence
from datetime import date

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0019"
down_revision: str | None = "0018"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

SOURCE = "Approximation: the 2024-10-01 zerodha.com/charges schedule applied from 2020-01-01 (D66)"
IDS = ("rate_eqdel_20200101", "rate_eqint_20200101")
# The same values as migration 0003 (copied: a migration never changes after it ships).
DELIVERY = {
    "brokerage_percent": "0",
    "brokerage_max_per_order_paise": None,
    "stt_buy_percent": "0.1",
    "stt_sell_percent": "0.1",
    "exchange_txn_percent": "0.00297",
    "sebi_per_crore_paise": "1000",
    "stamp_buy_percent": "0.015",
    "gst_percent": "18",
    "dp_per_sell_paise": "1300",
}
INTRADAY = {
    "brokerage_percent": "0.03",
    "brokerage_max_per_order_paise": "2000",
    "stt_buy_percent": "0",
    "stt_sell_percent": "0.025",
    "exchange_txn_percent": "0.00297",
    "sebi_per_crore_paise": "1000",
    "stamp_buy_percent": "0.003",
    "gst_percent": "18",
    "dp_per_sell_paise": "0",
}


def upgrade() -> None:
    table = sa.table(
        "charge_rates",
        sa.column("id", sa.Text()),
        sa.column("segment", sa.Text()),
        sa.column("effective_from", sa.Date()),
        sa.column("rates", postgresql.JSONB()),
        sa.column("source", sa.Text()),
    )
    day = date(2020, 1, 1)
    op.bulk_insert(
        table,
        [
            {
                "id": IDS[0],
                "segment": "equity_delivery",
                "effective_from": day,
                "rates": DELIVERY,
                "source": SOURCE,
            },
            {
                "id": IDS[1],
                "segment": "equity_intraday",
                "effective_from": day,
                "rates": INTRADAY,
                "source": SOURCE,
            },
        ],
    )


def downgrade() -> None:
    op.execute(
        sa.text("DELETE FROM charge_rates WHERE id IN :ids").bindparams(
            sa.bindparam("ids", value=list(IDS), expanding=True)
        )
    )
