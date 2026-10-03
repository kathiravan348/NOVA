"""Research profiles and their versions (NOVA-184, D84).

Revision ID: 0032
Revises: 0031
Create Date: 2026-10-04
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0032"
down_revision: str | None = "0031"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "research_profiles",
        sa.Column("id", sa.Text(), nullable=False),
        sa.Column("name", sa.Text(), nullable=False),
        sa.Column("description", sa.Text(), server_default="", nullable=False),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.CheckConstraint(
            "char_length(name) BETWEEN 1 AND 80", name=op.f("ck_research_profiles_name")
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_research_profiles")),
    )
    op.create_table(
        "research_profile_versions",
        sa.Column("profile_id", sa.Text(), nullable=False),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.Column("note", sa.Text(), server_default="", nullable=False),
        sa.Column("settings", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("frozen", sa.Boolean(), server_default=sa.false(), nullable=False),
        sa.Column("hash", sa.CHAR(length=64), nullable=True),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column("frozen_at", sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint("version >= 1", name=op.f("ck_research_profile_versions_version")),
        sa.CheckConstraint(
            "frozen = (hash IS NOT NULL) AND frozen = (frozen_at IS NOT NULL)",
            name=op.f("ck_research_profile_versions_frozen"),
        ),
        sa.ForeignKeyConstraint(
            ["profile_id"],
            ["research_profiles.id"],
            name=op.f("fk_research_profile_versions_profile_id_research_profiles"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("profile_id", "version", name=op.f("pk_research_profile_versions")),
    )


def downgrade() -> None:
    op.drop_table("research_profile_versions")
    op.drop_table("research_profiles")
