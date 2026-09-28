"""Keep broker-unavailable day evidence independently of download jobs (D70)."""

import sqlalchemy as sa
from alembic import op

revision = "0022"
down_revision = "0021"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "unavailable_days",
        sa.Column("id", sa.Text(), primary_key=True),
        sa.Column("exchange", sa.Text(), nullable=False),
        sa.Column("symbol", sa.Text(), nullable=False),
        sa.Column("timeframe", sa.Text(), nullable=False),
        sa.Column("day", sa.Date(), nullable=False),
        sa.Column("broker", sa.Text(), nullable=False),
        sa.Column("reason", sa.Text(), nullable=False),
        sa.Column("first_checked_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("last_checked_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("attempts", sa.Integer(), nullable=False),
        sa.Column("last_job_id", sa.Text(), sa.ForeignKey("data_jobs.id", ondelete="SET NULL")),
        sa.Column("last_check_id", sa.Text(), nullable=False),
        sa.Column("resolved_at", sa.DateTime(timezone=True)),
        sa.UniqueConstraint("exchange", "symbol", "timeframe", "day"),
        sa.CheckConstraint("timeframe IN ('1m', '1d')", name="timeframe"),
        sa.CheckConstraint("attempts > 0", name="attempts"),
        sa.CheckConstraint("last_checked_at >= first_checked_at", name="check_order"),
    )
    op.create_index(
        "ix_unavailable_days_first_checked_at_id", "unavailable_days", ["first_checked_at", "id"]
    )


def downgrade() -> None:
    op.drop_table("unavailable_days")
