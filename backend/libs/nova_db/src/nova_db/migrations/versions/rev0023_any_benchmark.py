"""Allow any stored index as a backtest benchmark (D72)."""

from alembic import op

revision = "0023"
down_revision = "0022"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.drop_constraint(op.f("ck_backtest_runs_benchmark"), "backtest_runs", type_="check")
    op.create_foreign_key(
        "fk_backtest_runs_benchmark_market_indices",
        "backtest_runs",
        "market_indices",
        ["benchmark"],
        ["name"],
    )


def downgrade() -> None:
    op.drop_constraint(
        "fk_backtest_runs_benchmark_market_indices", "backtest_runs", type_="foreignkey"
    )
    # Preserve runs created with the new choices when restoring the old restriction.
    op.execute("UPDATE backtest_runs SET benchmark = NULL WHERE benchmark <> 'NIFTY 50'")
    op.create_check_constraint(
        op.f("ck_backtest_runs_benchmark"),
        "backtest_runs",
        "benchmark IS NULL OR benchmark IN ('NIFTY 50')",
    )
