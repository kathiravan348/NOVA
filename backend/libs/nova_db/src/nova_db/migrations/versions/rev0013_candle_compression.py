"""Candles older than 30 days are compressed by TimescaleDB (NOVA-099, D58).

Revision ID: 0013
Revises: 0012
Create Date: 2026-09-26
"""

from collections.abc import Sequence

from alembic import op

revision: str = "0013"
down_revision: str | None = "0012"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # One segment per stock and timeframe keeps a single stock's reads fast.
    op.execute(
        "ALTER TABLE candles SET (timescaledb.compress,"
        " timescaledb.compress_segmentby = 'exchange, symbol, timeframe',"
        " timescaledb.compress_orderby = 'ts')"
    )
    op.execute(
        "SELECT add_compression_policy('candles', compress_after => INTERVAL '30 days',"
        " schedule_interval => INTERVAL '6 hours')"
    )


def downgrade() -> None:
    op.execute("SELECT remove_compression_policy('candles', if_exists => true)")
    op.execute("SELECT decompress_chunk(c, if_compressed => true) FROM show_chunks('candles') c")
    op.execute("ALTER TABLE candles SET (timescaledb.compress = false)")
