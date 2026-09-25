"""Live tick recording is switched on and off in Relay: the `recorder_settings` row (D54).

Revision ID: 0007
Revises: 0006
Create Date: 2026-09-25
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0007"
down_revision: str | None = "0006"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "recorder_settings",
        sa.Column("id", sa.SmallInteger(), nullable=False),
        sa.Column("enabled", sa.Boolean(), server_default="false", nullable=False),
        sa.Column("symbols", postgresql.ARRAY(sa.Text()), server_default="{}", nullable=False),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.CheckConstraint("id = 1", name=op.f("ck_recorder_settings_single_row")),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_recorder_settings")),
    )
    op.execute("INSERT INTO recorder_settings (id) VALUES (1)")


def downgrade() -> None:
    op.drop_table("recorder_settings")
