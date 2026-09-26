"""Backtest runs report their progress: stage, counts, date reached, percent (NOVA-101, D58).

Revision ID: 0014
Revises: 0013
Create Date: 2026-09-26
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0014"
down_revision: str | None = "0013"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

COUNTS = ("symbols_done", "symbols_total", "bars_done", "bars_total", "trades_so_far")


def upgrade() -> None:
    op.add_column("backtest_runs", sa.Column("stage", sa.Text(), nullable=True))
    op.add_column(
        "backtest_runs",
        sa.Column("progress_percent", sa.SmallInteger(), server_default="0", nullable=False),
    )
    for name in COUNTS:
        op.add_column(
            "backtest_runs", sa.Column(name, sa.Integer(), server_default="0", nullable=False)
        )
    op.add_column("backtest_runs", sa.Column("simulated_to", sa.Date(), nullable=True))
    op.create_check_constraint(
        op.f("ck_backtest_runs_stage"),
        "backtest_runs",
        "stage IN ('loading', 'signals', 'simulating', 'saving', 'done')",
    )
    op.create_check_constraint(
        op.f("ck_backtest_runs_progress_percent"),
        "backtest_runs",
        "progress_percent BETWEEN 0 AND 100",
    )
    op.create_check_constraint(
        op.f("ck_backtest_runs_progress_counts"),
        "backtest_runs",
        " AND ".join(f"{name} >= 0" for name in COUNTS),
    )
    # Runs finished before this migration read as done.
    op.execute(
        "UPDATE backtest_runs SET stage = 'done', progress_percent = 100 WHERE status = 'completed'"
    )


def downgrade() -> None:
    for name in ("progress_counts", "progress_percent", "stage"):
        op.drop_constraint(op.f(f"ck_backtest_runs_{name}"), "backtest_runs", type_="check")
    for name in ("simulated_to", *reversed(COUNTS), "progress_percent", "stage"):
        op.drop_column("backtest_runs", name)
