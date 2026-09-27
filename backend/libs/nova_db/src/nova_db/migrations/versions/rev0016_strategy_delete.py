"""Strategies can be deleted from Orbit: audit action `strategy.delete` (NOVA-112, D62).

Revision ID: 0016
Revises: 0015
Create Date: 2026-09-27
"""

from collections.abc import Sequence

from alembic import op

revision: str = "0016"
down_revision: str | None = "0015"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

# Frozen copy of the audit actions after 0015: a migration never reads enums.py.
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
    "backtest.edit",
    "backtest.delete",
)
NEW_ACTIONS = ("strategy.delete",)


def _in(column: str, values: tuple[str, ...]) -> str:
    return f"{column} IN (" + ", ".join(f"'{v}'" for v in values) + ")"


def _replace_action_check(values: tuple[str, ...]) -> None:
    op.drop_constraint(op.f("ck_audit_entries_action"), "audit_entries", type_="check")
    op.create_check_constraint(
        op.f("ck_audit_entries_action"), "audit_entries", _in("action", values)
    )


def upgrade() -> None:
    _replace_action_check((*OLD_ACTIONS, *NEW_ACTIONS))


def downgrade() -> None:
    op.execute("DELETE FROM audit_entries WHERE " + _in("action", NEW_ACTIONS))
    _replace_action_check(OLD_ACTIONS)
