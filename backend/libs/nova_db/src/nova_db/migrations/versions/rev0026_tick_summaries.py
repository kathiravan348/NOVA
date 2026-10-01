"""Daily tick summaries for Recorded data history (NOVA-160, D80).

Revision ID: 0026
Revises: 0025
Create Date: 2026-10-01
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0026"
down_revision: str | None = "0025"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "tick_sessions",
        sa.Column("day", sa.Date(), nullable=False),
        sa.Column("stocks", sa.Integer(), nullable=False),
        sa.Column("ticks", sa.BigInteger(), nullable=False),
        sa.Column("feed_gap_seconds", sa.Integer(), nullable=False),
        sa.Column("summarized_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint("stocks >= 0 AND ticks >= 0", name=op.f("ck_tick_sessions_counts")),
        sa.CheckConstraint(
            "feed_gap_seconds BETWEEN 0 AND 22500", name=op.f("ck_tick_sessions_feed_gap_seconds")
        ),
        sa.PrimaryKeyConstraint("day", name=op.f("pk_tick_sessions")),
    )
    op.create_table(
        "tick_days",
        sa.Column("exchange", sa.Text(), nullable=False),
        sa.Column("symbol", sa.Text(), nullable=False),
        sa.Column("day", sa.Date(), nullable=False),
        sa.Column("ticks", sa.BigInteger(), nullable=False),
        sa.Column("size_bytes", sa.BigInteger(), nullable=False),
        sa.Column("seconds_with_tick", sa.Integer(), nullable=False),
        sa.CheckConstraint("exchange IN ('NSE', 'NFO')", name=op.f("ck_tick_days_exchange")),
        sa.CheckConstraint("ticks > 0 AND size_bytes >= 0", name=op.f("ck_tick_days_counts")),
        sa.CheckConstraint(
            "seconds_with_tick BETWEEN 0 AND 22500", name=op.f("ck_tick_days_seconds_with_tick")
        ),
        sa.PrimaryKeyConstraint("exchange", "symbol", "day", name=op.f("pk_tick_days")),
    )


def downgrade() -> None:
    op.drop_table("tick_days")
    op.drop_table("tick_sessions")
