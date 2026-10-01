"""Every Kite tick field, and compressed tick chunks (NOVA-155, D77).

Adds nullable columns only (instant on a hypertable). Ticks older than 2 days are compressed
by TimescaleDB; the recorder only writes today's chunk.

Revision ID: 0025
Revises: 0024
Create Date: 2026-10-01
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import ARRAY

revision: str = "0025"
down_revision: str | None = "0024"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

SCALARS = (
    ("avg_price_paise", sa.BigInteger()),
    ("buy_qty", sa.BigInteger()),
    ("sell_qty", sa.BigInteger()),
    ("open_paise", sa.BigInteger()),
    ("high_paise", sa.BigInteger()),
    ("low_paise", sa.BigInteger()),
    ("close_paise", sa.BigInteger()),
    ("last_trade_ts", sa.DateTime(timezone=True)),
    ("oi_day_high", sa.BigInteger()),
    ("oi_day_low", sa.BigInteger()),
)
DEPTH = (
    ("bid_price_paise", sa.BigInteger()),
    ("bid_qty", sa.BigInteger()),
    ("bid_orders", sa.Integer()),
    ("ask_price_paise", sa.BigInteger()),
    ("ask_qty", sa.BigInteger()),
    ("ask_orders", sa.Integer()),
)


def upgrade() -> None:
    for name, kind in SCALARS:
        op.add_column("ticks", sa.Column(name, kind, nullable=True))
    for name, item in DEPTH:
        op.add_column("ticks", sa.Column(name, ARRAY(item), nullable=True))
    # One segment per stock keeps a single stock's day fast to read and archive.
    op.execute(
        "ALTER TABLE ticks SET (timescaledb.compress,"
        " timescaledb.compress_segmentby = 'exchange, symbol',"
        " timescaledb.compress_orderby = 'received_at')"
    )
    op.execute(
        "SELECT add_compression_policy('ticks', compress_after => INTERVAL '2 days',"
        " schedule_interval => INTERVAL '6 hours')"
    )


def downgrade() -> None:
    op.execute("SELECT remove_compression_policy('ticks', if_exists => true)")
    op.execute("SELECT decompress_chunk(c, if_compressed => true) FROM show_chunks('ticks') c")
    op.execute("ALTER TABLE ticks SET (timescaledb.compress = false)")
    for name, _ in (*SCALARS, *DEPTH):
        op.drop_column("ticks", name)
