"""Audit action `broker.account_create`: broker accounts added from Relay (D52).

Revision ID: 0005
Revises: 0004
Create Date: 2026-09-25
"""

from collections.abc import Sequence

from alembic import op

revision: str = "0005"
down_revision: str | None = "0004"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

# Frozen copies: a migration never reads enums.py, which keeps changing.
OLD = (
    "auth.login",
    "auth.logout",
    "broker.login",
    "broker.session_expired",
    "broker.rate_limit_update",
    "strategy.create",
    "strategy.update",
    "backtest.run",
    "data_job.create",
    "data_job.cancel",
    "settings.update",
)
NEW = (*OLD[:5], "broker.account_create", *OLD[5:])


def _replace(actions: tuple[str, ...]) -> None:
    quoted = ", ".join(f"'{action}'" for action in actions)
    op.drop_constraint(op.f("ck_audit_entries_action"), "audit_entries", type_="check")
    op.create_check_constraint(
        op.f("ck_audit_entries_action"), "audit_entries", f"action IN ({quoted})"
    )


def upgrade() -> None:
    _replace(NEW)


def downgrade() -> None:
    op.execute("DELETE FROM audit_entries WHERE action = 'broker.account_create'")
    _replace(OLD)
