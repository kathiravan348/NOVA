"""Daily Kite check of recorded ticks (NOVA-164, D81 (4)).

Revision ID: 0027
Revises: 0026
Create Date: 2026-10-03
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0027"
down_revision: str | None = "0026"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

COUNTS = (
    "stocks_checked",
    "stocks_skipped",
    "minutes",
    "close_matches",
    "range_ok",
    "volume_minutes",
    "volume_matches",
)


def upgrade() -> None:
    op.create_table(
        "tick_checks",
        sa.Column("day", sa.Date(), nullable=False),
        *(sa.Column(name, sa.Integer(), nullable=False) for name in COUNTS),
        sa.Column("clock_offset_ms", sa.BigInteger(), nullable=True),
        sa.Column("stocks", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("checked_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint(
            " AND ".join(f"{name} >= 0" for name in COUNTS), name=op.f("ck_tick_checks_counts")
        ),
        sa.CheckConstraint(
            "close_matches <= minutes AND range_ok <= minutes AND volume_minutes <= minutes"
            " AND volume_matches <= volume_minutes",
            name=op.f("ck_tick_checks_matches"),
        ),
        sa.PrimaryKeyConstraint("day", name=op.f("pk_tick_checks")),
    )


def downgrade() -> None:
    op.drop_table("tick_checks")
