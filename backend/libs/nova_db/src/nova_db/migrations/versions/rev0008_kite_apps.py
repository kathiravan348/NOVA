"""Each broker account has its own Kite app; the API secret is sealed by the Owner's passphrase (D55).

App details (plan, renewal, postback URL, static IP) move from `broker_profiles` to the new
`broker_kite_apps` table; the API key and the sealed secret are entered in Relay.

Revision ID: 0008
Revises: 0007
Create Date: 2026-09-26
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0008"
down_revision: str | None = "0007"
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
    "strategy.create",
    "strategy.update",
    "backtest.run",
    "data_job.create",
    "data_job.cancel",
    "instrument.add",
    "instrument.update",
    "instrument.remove",
    "instrument.sync",
    "settings.update",
)
NEW_ACTIONS = (*OLD_ACTIONS[:6], "broker.kite_app_update", *OLD_ACTIONS[6:])


def _actions(actions: tuple[str, ...]) -> None:
    quoted = ", ".join(f"'{action}'" for action in actions)
    op.drop_constraint(op.f("ck_audit_entries_action"), "audit_entries", type_="check")
    op.create_check_constraint(
        op.f("ck_audit_entries_action"), "audit_entries", f"action IN ({quoted})"
    )


def upgrade() -> None:
    op.create_table(
        "broker_kite_apps",
        sa.Column("account_id", sa.Text(), nullable=False),
        sa.Column("api_key", sa.Text(), nullable=True),
        sa.Column("api_secret_sealed", sa.LargeBinary(), nullable=True),
        sa.Column("plan", sa.Text(), nullable=True),
        sa.Column("subscription_renews_on", sa.Date(), nullable=True),
        sa.Column("postback_url", sa.Text(), nullable=True),
        sa.Column("static_ip", sa.Text(), nullable=True),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.CheckConstraint(
            "(api_key IS NULL) = (api_secret_sealed IS NULL)",
            name=op.f("ck_broker_kite_apps_keys_together"),
        ),
        sa.CheckConstraint(
            "api_key ~ '^[A-Za-z0-9]{6,64}$'", name=op.f("ck_broker_kite_apps_api_key")
        ),
        sa.ForeignKeyConstraint(
            ["account_id"],
            ["broker_accounts.id"],
            name=op.f("fk_broker_kite_apps_account_id_broker_accounts"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("account_id", name=op.f("pk_broker_kite_apps")),
    )
    # Today's (env-based) app details become each existing account's app details.
    op.execute(
        "INSERT INTO broker_kite_apps"
        " (account_id, plan, subscription_renews_on, postback_url, static_ip)"
        " SELECT a.id, p.plan, p.subscription_renews_on, p.postback_url, p.static_ip"
        " FROM broker_accounts a JOIN broker_profiles p ON p.broker = a.broker"
    )
    op.drop_constraint(op.f("ck_broker_profiles_api_key_last4"), "broker_profiles", type_="check")
    for column in (
        "plan",
        "subscription_renews_on",
        "api_key_last4",
        "redirect_url",
        "postback_url",
        "static_ip",
    ):
        op.drop_column("broker_profiles", column)
    _actions(NEW_ACTIONS)


def downgrade() -> None:
    op.execute("DELETE FROM audit_entries WHERE action = 'broker.kite_app_update'")
    _actions(OLD_ACTIONS)
    # Profiles are rewritten at broker start-up; the placeholders only satisfy NOT NULL.
    op.add_column(
        "broker_profiles",
        sa.Column("plan", sa.Text(), server_default="Kite Connect", nullable=False),
    )
    op.add_column("broker_profiles", sa.Column("subscription_renews_on", sa.Date(), nullable=True))
    op.add_column(
        "broker_profiles",
        sa.Column("api_key_last4", sa.Text(), server_default="0000", nullable=False),
    )
    op.add_column(
        "broker_profiles",
        sa.Column("redirect_url", sa.Text(), server_default="http://localhost", nullable=False),
    )
    op.add_column("broker_profiles", sa.Column("postback_url", sa.Text(), nullable=True))
    op.add_column("broker_profiles", sa.Column("static_ip", sa.Text(), nullable=True))
    for column in ("plan", "api_key_last4", "redirect_url"):
        op.alter_column("broker_profiles", column, server_default=None)
    op.create_check_constraint(
        op.f("ck_broker_profiles_api_key_last4"),
        "broker_profiles",
        "api_key_last4 ~ '^[A-Za-z0-9]{4}$'",
    )
    op.drop_table("broker_kite_apps")
