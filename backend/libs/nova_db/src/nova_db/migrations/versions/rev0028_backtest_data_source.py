"""Backtest data source (history or recorded ticks), recorded days and spread cost (NOVA-166, D82).

Old runs read back as `history` with no recorded days; `spread_cost_paise` is null for them.

Revision ID: 0028
Revises: 0027
Create Date: 2026-10-03
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0028"
down_revision: str | None = "0027"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "backtest_runs",
        sa.Column("data_source", sa.Text(), server_default="history", nullable=False),
    )
    op.create_check_constraint(
        op.f("ck_backtest_runs_data_source"),
        "backtest_runs",
        "data_source IN ('history', 'recorded')",
    )
    op.add_column("backtest_runs", sa.Column("recorded_days_used", sa.Integer(), nullable=True))
    op.create_check_constraint(
        op.f("ck_backtest_runs_recorded_days_used"),
        "backtest_runs",
        "recorded_days_used IS NULL OR recorded_days_used >= 0",
    )
    op.add_column(
        "backtest_runs",
        sa.Column(
            "recorded_days_skipped",
            postgresql.ARRAY(sa.Date()),
            server_default=sa.text("'{}'"),
            nullable=False,
        ),
    )
    op.add_column(
        "backtest_results", sa.Column("spread_cost_paise", sa.BigInteger(), nullable=True)
    )


def downgrade() -> None:
    op.drop_column("backtest_results", "spread_cost_paise")
    op.drop_column("backtest_runs", "recorded_days_skipped")
    op.drop_constraint(op.f("ck_backtest_runs_recorded_days_used"), "backtest_runs")
    op.drop_column("backtest_runs", "recorded_days_used")
    op.drop_constraint(op.f("ck_backtest_runs_data_source"), "backtest_runs")
    op.drop_column("backtest_runs", "data_source")
