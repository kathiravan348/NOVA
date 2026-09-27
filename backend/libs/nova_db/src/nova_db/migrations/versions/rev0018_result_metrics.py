"""Benchmark, D62 metrics, estimated tax and the year-by-year table on backtest results (NOVA-116).

Every new column is nullable (older results show "—"); `years` defaults to an empty list.

Revision ID: 0018
Revises: 0017
Create Date: 2026-09-27
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0018"
down_revision: str | None = "0017"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

NUMBERS = (
    "benchmark_return_percent",
    "benchmark_cagr_percent",
    "exposure_percent",
    "avg_hold_days",
    "profit_factor",
    "calmar",
    "after_tax_cagr_percent",
)
PAISE = ("estimated_tax_paise", "after_tax_net_pnl_paise")


def upgrade() -> None:
    for name in NUMBERS:
        op.add_column("backtest_results", sa.Column(name, sa.Numeric(), nullable=True))
    for name in PAISE:
        op.add_column("backtest_results", sa.Column(name, sa.BigInteger(), nullable=True))
    op.add_column(
        "backtest_results",
        sa.Column(
            "years",
            postgresql.JSONB(astext_type=sa.Text()),
            server_default=sa.text("'[]'::jsonb"),
            nullable=False,
        ),
    )
    op.create_check_constraint(
        op.f("ck_backtest_results_exposure"),
        "backtest_results",
        "exposure_percent BETWEEN 0 AND 100",
    )
    op.create_check_constraint(
        op.f("ck_backtest_results_tax"), "backtest_results", "estimated_tax_paise >= 0"
    )


def downgrade() -> None:
    op.drop_constraint(op.f("ck_backtest_results_tax"), "backtest_results", type_="check")
    op.drop_constraint(op.f("ck_backtest_results_exposure"), "backtest_results", type_="check")
    for name in ("years", *PAISE, *NUMBERS):
        op.drop_column("backtest_results", name)
