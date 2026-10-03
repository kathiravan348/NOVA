"""Record selected indices (NOVA-179, D84).

Revision ID: 0030
Revises: 0029
Create Date: 2026-10-03
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import ARRAY

revision: str = "0030"
down_revision: str | None = "0029"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "recorder_settings",
        sa.Column("indices", ARRAY(sa.Text()), nullable=False, server_default="{}"),
    )
    op.create_table(
        "index_ticks",
        sa.Column("symbol", sa.Text(), sa.ForeignKey("market_indices.name"), primary_key=True),
        sa.Column("received_at", sa.DateTime(timezone=True), primary_key=True),
        sa.Column("exchange_ts", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_price_paise", sa.BigInteger(), nullable=False),
        *(
            sa.Column(f"{name}_paise", sa.BigInteger(), nullable=True)
            for name in ("high", "low", "open", "close")
        ),
        sa.CheckConstraint("last_price_paise > 0", name="last_price"),
        *(
            sa.CheckConstraint(f"{name}_paise > 0", name=name)
            for name in ("high", "low", "open", "close")
        ),
    )
    op.execute(
        "SELECT create_hypertable('index_ticks', by_range('received_at', INTERVAL '1 day'),"
        " create_default_indexes => false)"
    )
    op.execute(
        "ALTER TABLE index_ticks SET (timescaledb.compress, timescaledb.compress_segmentby = 'symbol', timescaledb.compress_orderby = 'received_at')"
    )
    op.execute(
        "SELECT add_compression_policy('index_ticks', compress_after => INTERVAL '2 days', schedule_interval => INTERVAL '6 hours')"
    )


def downgrade() -> None:
    op.execute("SELECT remove_compression_policy('index_ticks', if_exists => true)")
    op.drop_table("index_ticks")
    op.drop_column("recorder_settings", "indices")
