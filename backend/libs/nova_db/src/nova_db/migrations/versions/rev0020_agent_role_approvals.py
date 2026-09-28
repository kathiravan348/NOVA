"""Agent role and held requests (NOVA-131, D67).

Revision ID: 0020
Revises: 0019
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0020"
down_revision: str | None = "0019"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

# Frozen pre-0020 enum values: migration history never reads live enums.
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
    "strategy.delete",
    "backtest.run",
    "backtest.edit",
    "backtest.delete",
    "data_job.create",
    "data_job.cancel",
    "data_job.plan",
    "data_job.start",
    "data_job.pause",
    "data_job.resume",
    "data_job.delete",
    "instrument.add",
    "instrument.update",
    "instrument.remove",
    "instrument.sync",
    "instrument.clear_new",
    "settings.update",
    "download_settings.update",
)
OLD_TARGETS = (
    "user",
    "broker_account",
    "strategy",
    "backtest",
    "data_job",
    "settings",
    "instrument",
)
NEW_ACTIONS = (
    "approval.request",
    "approval.approve",
    "approval.reject",
    "agent.create",
    "agent.password",
    "agent.access",
)
NEW_TARGETS = ("approval_request",)


def _in(column: str, values: tuple[str, ...]) -> str:
    return f"{column} IN (" + ", ".join(f"'{v}'" for v in values) + ")"


def _audit_checks(actions: tuple[str, ...], targets: tuple[str, ...]) -> None:
    for column, values in (("action", actions), ("target_type", targets)):
        name = op.f(f"ck_audit_entries_{column}")
        op.drop_constraint(name, "audit_entries", type_="check")
        op.create_check_constraint(name, "audit_entries", _in(column, values))


def upgrade() -> None:
    op.execute("INSERT INTO roles (id, name) VALUES ('agent', 'Agent')")
    op.add_column("users", sa.Column("disabled_at", sa.DateTime(timezone=True), nullable=True))
    op.create_table(
        "approval_requests",
        sa.Column("id", sa.Text(), primary_key=True),
        sa.Column(
            "agent_id", sa.Text(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False
        ),
        sa.Column("method", sa.Text(), nullable=False),
        sa.Column("path", sa.Text(), nullable=False),
        sa.Column("query", sa.Text(), nullable=False, server_default=sa.text("''")),
        sa.Column("body", postgresql.JSONB(), nullable=True),
        sa.Column("status", sa.Text(), nullable=False, server_default=sa.text("'pending'")),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
        sa.Column("decided_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "decided_by", sa.Text(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True
        ),
        sa.Column("result_status", sa.Integer(), nullable=True),
        sa.Column("result_body", sa.Text(), nullable=True),
        sa.CheckConstraint(_in("method", ("POST", "PUT", "PATCH", "DELETE")), name="method"),
        sa.CheckConstraint(
            _in("status", ("pending", "done", "failed", "rejected", "expired")), name="status"
        ),
    )
    op.create_index(
        "ix_approval_requests_status_created_at", "approval_requests", ["status", "created_at"]
    )
    _audit_checks((*OLD_ACTIONS, *NEW_ACTIONS), (*OLD_TARGETS, *NEW_TARGETS))


def downgrade() -> None:
    op.execute(
        "DELETE FROM audit_entries WHERE "
        + _in("action", NEW_ACTIONS)
        + " OR "
        + _in("target_type", NEW_TARGETS)
    )
    _audit_checks(OLD_ACTIONS, OLD_TARGETS)
    op.drop_table("approval_requests")
    op.drop_column("users", "disabled_at")
    op.execute("DELETE FROM user_roles WHERE role_id = 'agent'")
    op.execute("DELETE FROM roles WHERE id = 'agent'")
