"""Intraday decision log: every candidate with its first blocking reason and all failed checks
(NOVA-186, D84).

Revision ID: 0034
Revises: 0033
Create Date: 2026-10-04
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0034"
down_revision: str | None = "0033"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "intraday_decisions",
        sa.Column("id", sa.Text(), nullable=False),
        sa.Column("run_id", sa.Text(), nullable=False),
        sa.Column("at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("symbol", sa.Text(), nullable=False),
        sa.Column("setup", sa.Text(), nullable=False),
        sa.Column("action", sa.Text(), nullable=False),
        sa.Column("outcome", sa.Text(), nullable=False),
        sa.Column("first_reason", sa.Text(), nullable=True),
        sa.Column(
            "reasons", postgresql.ARRAY(sa.Text()), server_default=sa.text("'{}'"), nullable=False
        ),
        sa.Column("requested_qty", sa.Integer(), nullable=False),
        sa.Column("filled_qty", sa.Integer(), nullable=False),
        sa.Column("trade_id", sa.Text(), nullable=True),
        sa.CheckConstraint("action IN ('entry', 'add')", name=op.f("ck_intraday_decisions_action")),
        sa.CheckConstraint(
            "outcome IN ('filled', 'partial', 'skipped')",
            name=op.f("ck_intraday_decisions_outcome"),
        ),
        sa.CheckConstraint(
            "(outcome = 'skipped') = (first_reason IS NOT NULL)",
            name=op.f("ck_intraday_decisions_skip_has_reason"),
        ),
        sa.CheckConstraint(
            "requested_qty >= 0 AND filled_qty >= 0", name=op.f("ck_intraday_decisions_quantities")
        ),
        sa.ForeignKeyConstraint(
            ["run_id"],
            ["backtest_runs.id"],
            name=op.f("fk_intraday_decisions_run_id_backtest_runs"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["trade_id"],
            ["trades.id"],
            name=op.f("fk_intraday_decisions_trade_id_trades"),
            ondelete="SET NULL",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_intraday_decisions")),
    )
    op.create_index(op.f("ix_intraday_decisions_run_id_at"), "intraday_decisions", ["run_id", "at"])


def downgrade() -> None:
    op.drop_index(op.f("ix_intraday_decisions_run_id_at"), table_name="intraday_decisions")
    op.drop_table("intraday_decisions")
