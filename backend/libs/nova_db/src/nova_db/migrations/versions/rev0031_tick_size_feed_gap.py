"""Instrument tick size and longest session feed gap (NOVA-181, D84).

Revision ID: 0031
Revises: 0030
Create Date: 2026-10-03
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0031"
down_revision: str | None = "0030"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("instruments", sa.Column("tick_size_paise", sa.Integer(), nullable=True))
    op.create_check_constraint("tick_size_paise", "instruments", "tick_size_paise > 0")
    op.add_column(
        "tick_sessions", sa.Column("longest_feed_gap_seconds", sa.Integer(), nullable=True)
    )
    op.create_check_constraint(
        "longest_feed_gap_seconds", "tick_sessions", "longest_feed_gap_seconds BETWEEN 0 AND 22500"
    )


def downgrade() -> None:
    op.drop_constraint("ck_tick_sessions_longest_feed_gap_seconds", "tick_sessions", type_="check")
    op.drop_column("tick_sessions", "longest_feed_gap_seconds")
    op.drop_constraint("ck_instruments_tick_size_paise", "instruments", type_="check")
    op.drop_column("instruments", "tick_size_paise")
