"""Nullable trade exit reason (NOVA-174, D82).

Revision ID: 0029
Revises: 0028
Create Date: 2026-10-03
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0029"
down_revision: str | None = "0028"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("trades", sa.Column("exit_reason", sa.Text(), nullable=True))
    op.create_check_constraint(
        op.f("ck_trades_exit_reason"),
        "trades",
        "exit_reason IN ('signal', 'stop', 'target', 'time_exit', 'square_off',"
        " 'market_filter', 'rotation', 'end_of_period')",
    )


def downgrade() -> None:
    op.drop_constraint(op.f("ck_trades_exit_reason"), "trades")
    op.drop_column("trades", "exit_reason")
