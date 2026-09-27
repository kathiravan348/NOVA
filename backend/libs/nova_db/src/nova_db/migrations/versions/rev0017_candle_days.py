"""Bars per IST day of each stored series, for the Stored data page (NOVA-124, D63).

Revision ID: 0017
Revises: 0016
Create Date: 2026-09-27
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0017"
down_revision: str | None = "0016"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "candle_days",
        sa.Column("exchange", sa.Text(), nullable=False),
        sa.Column("symbol", sa.Text(), nullable=False),
        sa.Column("timeframe", sa.Text(), nullable=False),
        sa.Column("day", sa.Date(), nullable=False),
        sa.Column("bars", sa.Integer(), nullable=False),
        sa.CheckConstraint("timeframe IN ('1m', '1d')", name=op.f("ck_candle_days_timeframe")),
        sa.CheckConstraint("bars > 0", name=op.f("ck_candle_days_bars")),
        sa.PrimaryKeyConstraint(
            "exchange", "symbol", "timeframe", "day", name=op.f("pk_candle_days")
        ),
    )
    # One pass over the stored candles (measured 27 Sep: 12 s for 40 M rows); downloads keep it current.
    op.execute(
        "INSERT INTO candle_days (exchange, symbol, timeframe, day, bars)"
        " SELECT exchange, symbol, timeframe, (ts AT TIME ZONE 'Asia/Kolkata')::date, count(*)"
        " FROM candles WHERE timeframe IN ('1m', '1d') GROUP BY 1, 2, 3, 4"
    )


def downgrade() -> None:
    op.drop_table("candle_days")
