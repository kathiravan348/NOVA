"""Charge rates with effective dates (NOVA Ledger, D42), seeded with Zerodha's equity schedule.

Revision ID: 0003
Revises: 0002
Create Date: 2026-09-25

Source: zerodha.com/charges (NSE equity, effective 2024-10-01). Percentages are Decimal strings of the
trade value; paise amounts are per crore of turnover (SEBI), per order (brokerage cap) or per sell (DP).
A rate change is a new row with a later `effective_from`, never an edit.
"""

from collections.abc import Sequence
from datetime import date

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0003"
down_revision: str | None = "0002"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

SOURCE = "https://zerodha.com/charges (NSE equity, from 2024-10-01)"
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
    table = op.create_table(
        "charge_rates",
        sa.Column("id", sa.Text(), nullable=False),
        sa.Column("segment", sa.Text(), nullable=False),
        sa.Column("effective_from", sa.Date(), nullable=False),
        sa.Column("rates", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("source", sa.Text(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint(
            "segment IN ('equity_delivery', 'equity_intraday', 'futures', 'options')",
            name=op.f("ck_charge_rates_segment"),
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_charge_rates")),
        sa.UniqueConstraint(
            "segment", "effective_from", name=op.f("uq_charge_rates_segment_effective_from")
        ),
    )
    day = date(2024, 10, 1)
    op.bulk_insert(
        table,
        [
            {
                "id": "rate_eqdel_20241001",
                "segment": "equity_delivery",
                "effective_from": day,
                "rates": DELIVERY,
                "source": SOURCE,
            },
            {
                "id": "rate_eqint_20241001",
                "segment": "equity_intraday",
                "effective_from": day,
                "rates": INTRADAY,
                "source": SOURCE,
            },
        ],
    )


def downgrade() -> None:
    op.drop_table("charge_rates")
