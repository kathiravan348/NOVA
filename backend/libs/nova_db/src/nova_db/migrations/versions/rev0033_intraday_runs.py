"""Intraday runs: profile, scenario, incomplete flag, history inputs; intraday trade details
(NOVA-185, D84).

Revision ID: 0033
Revises: 0032
Create Date: 2026-10-04
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0033"
down_revision: str | None = "0032"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

OLD_REASONS = (
    "'signal', 'stop', 'target', 'time_exit', 'square_off', 'market_filter', 'rotation',"
    " 'end_of_period'"
)
NEW_REASONS = OLD_REASONS + ", 'daily_shutdown', 'unresolved'"


def upgrade() -> None:
    for column in (
        sa.Column("profile_id", sa.Text(), nullable=True),
        sa.Column("profile_version", sa.Integer(), nullable=True),
        sa.Column("scenario", sa.Text(), nullable=True),
        sa.Column("experiment_id", sa.Text(), nullable=True),
        sa.Column("incomplete", sa.Boolean(), server_default=sa.false(), nullable=False),
        sa.Column(
            "history_inputs",
            postgresql.ARRAY(sa.Text()),
            server_default=sa.text("'{}'"),
            nullable=False,
        ),
    ):
        op.add_column("backtest_runs", column)
    op.create_foreign_key(
        op.f("fk_backtest_runs_profile_id_research_profile_versions"),
        "backtest_runs",
        "research_profile_versions",
        ["profile_id", "profile_version"],
        ["profile_id", "version"],
    )
    op.create_check_constraint(
        op.f("ck_backtest_runs_scenario"), "backtest_runs", "scenario IN ('base', 'stress')"
    )
    op.create_check_constraint(
        op.f("ck_backtest_runs_profile_choice"),
        "backtest_runs",
        "(profile_id IS NULL) = (profile_version IS NULL)"
        " AND (profile_id IS NULL) = (scenario IS NULL)",
    )
    op.drop_constraint(op.f("ck_trades_exit_reason"), "trades")
    op.create_check_constraint(
        op.f("ck_trades_exit_reason"), "trades", f"exit_reason IN ({NEW_REASONS})"
    )
    op.create_table(
        "intraday_trades",
        sa.Column("trade_id", sa.Text(), nullable=False),
        sa.Column("stop_paise", sa.BigInteger(), nullable=False),
        sa.Column("target_paise", sa.BigInteger(), nullable=True),
        sa.Column("first_fill_paise", sa.BigInteger(), nullable=False),
        sa.Column("risk_paise", sa.BigInteger(), nullable=False),
        sa.Column("legs", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("unresolved", sa.Boolean(), server_default=sa.false(), nullable=False),
        sa.CheckConstraint(
            "stop_paise > 0 AND first_fill_paise > stop_paise AND risk_paise > 0",
            name=op.f("ck_intraday_trades_levels"),
        ),
        sa.CheckConstraint(
            "target_paise IS NULL OR target_paise > 0", name=op.f("ck_intraday_trades_target")
        ),
        sa.ForeignKeyConstraint(
            ["trade_id"],
            ["trades.id"],
            name=op.f("fk_intraday_trades_trade_id_trades"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("trade_id", name=op.f("pk_intraday_trades")),
    )


def downgrade() -> None:
    op.drop_table("intraday_trades")
    # Intraday trades leave with their runs' new exit reasons (the old check refuses them).
    op.execute(
        "DELETE FROM backtest_runs WHERE id IN (SELECT run_id FROM trades"
        " WHERE exit_reason IN ('daily_shutdown', 'unresolved'))"
    )
    op.drop_constraint(op.f("ck_trades_exit_reason"), "trades")
    op.create_check_constraint(
        op.f("ck_trades_exit_reason"), "trades", f"exit_reason IN ({OLD_REASONS})"
    )
    op.drop_constraint(op.f("ck_backtest_runs_profile_choice"), "backtest_runs")
    op.drop_constraint(op.f("ck_backtest_runs_scenario"), "backtest_runs")
    op.drop_constraint(
        op.f("fk_backtest_runs_profile_id_research_profile_versions"), "backtest_runs"
    )
    for name in (
        "history_inputs",
        "incomplete",
        "experiment_id",
        "scenario",
        "profile_version",
        "profile_id",
    ):
        op.drop_column("backtest_runs", name)
