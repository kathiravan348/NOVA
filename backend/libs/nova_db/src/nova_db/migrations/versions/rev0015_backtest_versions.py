"""Backtests are version chains; old versions can be trimmed to their summary (NOVA-105, D60).

Revision ID: 0015
Revises: 0014
Create Date: 2026-09-27
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0015"
down_revision: str | None = "0014"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

# Frozen copy of the audit actions after 0011: a migration never reads enums.py.
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
)
BACKTEST_ACTIONS = ("backtest.edit", "backtest.delete")


def _in(column: str, values: tuple[str, ...]) -> str:
    return f"{column} IN (" + ", ".join(f"'{v}'" for v in values) + ")"


def _replace_check(table: str, name: str, sql: str) -> None:
    op.drop_constraint(op.f(f"ck_{table}_{name}"), table, type_="check")
    op.create_check_constraint(op.f(f"ck_{table}_{name}"), table, sql)


def upgrade() -> None:
    op.add_column("backtest_runs", sa.Column("root_id", sa.Text(), nullable=True))
    op.execute("UPDATE backtest_runs SET root_id = id")
    op.alter_column("backtest_runs", "root_id", nullable=False)
    op.add_column(
        "backtest_runs", sa.Column("version", sa.Integer(), server_default="1", nullable=False)
    )
    op.add_column(
        "backtest_runs",
        sa.Column("report_kept", sa.Boolean(), server_default=sa.true(), nullable=False),
    )
    op.create_unique_constraint(
        op.f("uq_backtest_runs_root_id_version"), "backtest_runs", ["root_id", "version"]
    )
    op.create_check_constraint(op.f("ck_backtest_runs_version"), "backtest_runs", "version >= 1")
    op.create_check_constraint(
        op.f("ck_backtest_runs_root_first"),
        "backtest_runs",
        "(version = 1) = (root_id = id)",
    )
    _replace_check("audit_entries", "action", _in("action", (*OLD_ACTIONS, *BACKTEST_ACTIONS)))


def downgrade() -> None:
    op.execute("DELETE FROM audit_entries WHERE " + _in("action", BACKTEST_ACTIONS))
    _replace_check("audit_entries", "action", _in("action", OLD_ACTIONS))
    op.execute("DELETE FROM backtest_runs WHERE version > 1")
    op.drop_constraint(op.f("ck_backtest_runs_root_first"), "backtest_runs", type_="check")
    op.drop_constraint(op.f("ck_backtest_runs_version"), "backtest_runs", type_="check")
    op.drop_constraint(op.f("uq_backtest_runs_root_id_version"), "backtest_runs", type_="unique")
    for name in ("report_kept", "version", "root_id"):
        op.drop_column("backtest_runs", name)
