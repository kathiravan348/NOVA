"""Persist completed instrument-sync stocks without history (D74, NOVA-150)."""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB

revision = "0024"
down_revision = "0023"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("data_jobs", sa.Column("sync_result", JSONB(none_as_null=True), nullable=True))
    op.create_check_constraint(
        op.f("ck_data_jobs_sync_result"),
        "data_jobs",
        "sync_result IS NULL OR (type = 'instrument_sync' AND status = 'completed')",
    )


def downgrade() -> None:
    op.drop_constraint(op.f("ck_data_jobs_sync_result"), "data_jobs", type_="check")
    op.drop_column("data_jobs", "sync_result")
