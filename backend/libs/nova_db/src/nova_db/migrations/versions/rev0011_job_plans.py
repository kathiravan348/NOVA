"""Planned, resumable downloads (D57): draft/paused jobs, job steps, download settings.

Revision ID: 0011
Revises: 0010
Create Date: 2026-09-26
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0011"
down_revision: str | None = "0010"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

# Frozen copies: a migration never reads enums.py, which keeps changing.
OLD_ACTIONS = (
    "auth.login",
    "auth.logout",
    "broker.login",
    "broker.session_expired",
    "broker.rate_limit_update",
    "broker.account_create",
    "broker.kite_app_update",
    "strategy.create",
    "strategy.update",
    "backtest.run",
    "data_job.create",
    "data_job.cancel",
    "instrument.add",
    "instrument.update",
    "instrument.remove",
    "instrument.sync",
    "instrument.clear_new",
    "settings.update",
)
JOB_ACTIONS = (
    "data_job.plan",
    "data_job.start",
    "data_job.pause",
    "data_job.resume",
    "data_job.delete",
)
NEW_ACTIONS = (*OLD_ACTIONS[:12], *JOB_ACTIONS, *OLD_ACTIONS[12:], "download_settings.update")
OLD_STATUSES = ("queued", "running", "completed", "failed", "cancelled")
NEW_STATUSES = ("draft", *OLD_STATUSES, "paused")


def _in(column: str, values: tuple[str, ...]) -> str:
    return f"{column} IN (" + ", ".join(f"'{v}'" for v in values) + ")"


def _replace_check(table: str, name: str, sql: str) -> None:
    op.drop_constraint(op.f(f"ck_{table}_{name}"), table, type_="check")
    op.create_check_constraint(op.f(f"ck_{table}_{name}"), table, sql)


def upgrade() -> None:
    _replace_check("data_jobs", "status", _in("status", NEW_STATUSES))
    op.add_column("data_jobs", sa.Column("mode", sa.Text(), nullable=True))
    op.add_column(
        "data_jobs", sa.Column("plan", postgresql.JSONB(astext_type=sa.Text()), nullable=True)
    )
    op.add_column("data_jobs", sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column(
        "data_jobs", sa.Column("steps_total", sa.Integer(), server_default="0", nullable=False)
    )
    op.add_column(
        "data_jobs", sa.Column("steps_done", sa.Integer(), server_default="0", nullable=False)
    )
    op.create_check_constraint(
        op.f("ck_data_jobs_steps"), "data_jobs", "steps_done BETWEEN 0 AND steps_total"
    )
    op.create_check_constraint(
        op.f("ck_data_jobs_mode"),
        "data_jobs",
        "mode IS NULL OR (type = 'historical_download' AND mode IN ('skip_existing', 'overwrite'))",
    )
    op.create_check_constraint(
        op.f("ck_data_jobs_draft"),
        "data_jobs",
        "status <> 'draft' OR (started_at IS NULL AND finished_at IS NULL"
        " AND expires_at IS NOT NULL AND plan IS NOT NULL)",
    )
    op.create_check_constraint(
        op.f("ck_data_jobs_expires_only_draft"),
        "data_jobs",
        "expires_at IS NULL OR status = 'draft'",
    )

    op.create_table(
        "data_job_steps",
        sa.Column("job_id", sa.Text(), nullable=False),
        sa.Column("seq", sa.Integer(), nullable=False),
        sa.Column("symbol", sa.Text(), nullable=False),
        sa.Column("start_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("end_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("status", sa.Text(), server_default="pending", nullable=False),
        sa.Column("rows_written", sa.Integer(), server_default="0", nullable=False),
        sa.Column("finished_at", sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint(
            "status IN ('pending', 'done', 'skipped')", name=op.f("ck_data_job_steps_status")
        ),
        sa.CheckConstraint("start_at < end_at", name=op.f("ck_data_job_steps_period")),
        sa.CheckConstraint("seq >= 0 AND rows_written >= 0", name=op.f("ck_data_job_steps_counts")),
        sa.CheckConstraint(
            "(status = 'pending') = (finished_at IS NULL)", name=op.f("ck_data_job_steps_finished")
        ),
        sa.ForeignKeyConstraint(
            ["job_id"],
            ["data_jobs.id"],
            name=op.f("fk_data_job_steps_job_id_data_jobs"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("job_id", "seq", name=op.f("pk_data_job_steps")),
    )
    op.create_index(
        op.f("ix_data_job_steps_job_id_status_seq"),
        "data_job_steps",
        ["job_id", "status", "seq"],
    )

    settings = op.create_table(
        "download_settings",
        sa.Column("id", sa.SmallInteger(), nullable=False),
        sa.Column("market_hours_mode", sa.Text(), server_default="slow", nullable=False),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column("updated_by", sa.Text(), nullable=True),
        sa.CheckConstraint("id = 1", name=op.f("ck_download_settings_single_row")),
        sa.CheckConstraint(
            "market_hours_mode IN ('slow', 'full')",
            name=op.f("ck_download_settings_market_hours_mode"),
        ),
        sa.ForeignKeyConstraint(
            ["updated_by"],
            ["users.id"],
            name=op.f("fk_download_settings_updated_by_users"),
            ondelete="SET NULL",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_download_settings")),
    )
    op.bulk_insert(settings, [{"id": 1}])

    _replace_check("audit_entries", "action", _in("action", NEW_ACTIONS))


def downgrade() -> None:
    op.execute(
        "DELETE FROM audit_entries WHERE "
        + _in("action", (*JOB_ACTIONS, "download_settings.update"))
    )
    _replace_check("audit_entries", "action", _in("action", OLD_ACTIONS))
    op.drop_table("download_settings")
    op.drop_index(op.f("ix_data_job_steps_job_id_status_seq"), table_name="data_job_steps")
    op.drop_table("data_job_steps")
    op.execute("DELETE FROM data_jobs WHERE status = 'draft'")
    op.execute("UPDATE data_jobs SET status = 'cancelled' WHERE status = 'paused'")
    op.drop_constraint(op.f("ck_data_jobs_expires_only_draft"), "data_jobs", type_="check")
    op.drop_constraint(op.f("ck_data_jobs_draft"), "data_jobs", type_="check")
    op.drop_constraint(op.f("ck_data_jobs_mode"), "data_jobs", type_="check")
    op.drop_constraint(op.f("ck_data_jobs_steps"), "data_jobs", type_="check")
    op.drop_column("data_jobs", "steps_done")
    op.drop_column("data_jobs", "steps_total")
    op.drop_column("data_jobs", "expires_at")
    op.drop_column("data_jobs", "plan")
    op.drop_column("data_jobs", "mode")
    _replace_check("data_jobs", "status", _in("status", OLD_STATUSES))
