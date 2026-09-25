"""Live ticks from Kite's WebSocket as a TimescaleDB hypertable (D11, D49).

Revision ID: 0004
Revises: 0003
Create Date: 2026-09-25
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0004"
down_revision: str | None = "0003"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "ticks",
        sa.Column("exchange", sa.Text(), nullable=False),
        sa.Column("symbol", sa.Text(), nullable=False),
        sa.Column("received_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("exchange_ts", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_price_paise", sa.BigInteger(), nullable=False),
        sa.Column("last_qty", sa.BigInteger(), nullable=False),
        sa.Column("volume", sa.BigInteger(), nullable=False),
        sa.Column("oi", sa.BigInteger(), nullable=True),
        sa.CheckConstraint("exchange IN ('NSE', 'NFO')", name=op.f("ck_ticks_exchange")),
        sa.CheckConstraint(
            "last_price_paise > 0 AND last_qty >= 0 AND volume >= 0", name=op.f("ck_ticks_values")
        ),
        sa.PrimaryKeyConstraint("exchange", "symbol", "received_at", name=op.f("pk_ticks")),
    )
    op.execute(
        "SELECT create_hypertable('ticks', by_range('received_at', INTERVAL '1 day'),"
        " create_default_indexes => false)"
    )


def downgrade() -> None:
    op.drop_table("ticks")
