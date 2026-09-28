"""Store index members skipped because they have no prices in the period (D68)."""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "0021"
down_revision = "0020"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "backtest_runs",
        sa.Column(
            "skipped_symbols", postgresql.ARRAY(sa.Text()), nullable=False, server_default="{}"
        ),
    )


def downgrade() -> None:
    op.drop_column("backtest_runs", "skipped_symbols")
