"""Indices become rows, stocks can be new listings, and sync is a data job (D56).

Revision ID: 0009
Revises: 0008
Create Date: 2026-09-26
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0009"
down_revision: str | None = "0008"
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
    "settings.update",
)
NEW_ACTIONS = (*OLD_ACTIONS[:16], "instrument.clear_new", *OLD_ACTIONS[16:])
OLD_JOB_TYPES = ("historical_download", "tick_record", "archive")
NEW_JOB_TYPES = (*OLD_JOB_TYPES, "instrument_sync")
OLD_INDICES = ("NIFTY 50", "NIFTY BANK", "NIFTY NEXT 50")

# (name = Kite trading symbol, NSE constituent file on niftyindices.com)
INDICES: tuple[tuple[str, str], ...] = (
    ("NIFTY 50", "ind_nifty50list.csv"),
    ("NIFTY NEXT 50", "ind_niftynext50list.csv"),
    ("NIFTY 100", "ind_nifty100list.csv"),
    ("NIFTY 200", "ind_nifty200list.csv"),
    ("NIFTY 500", "ind_nifty500list.csv"),
    ("NIFTY MIDCAP 100", "ind_niftymidcap100list.csv"),
    ("NIFTY SMLCAP 100", "ind_niftysmallcap100list.csv"),
    ("NIFTY BANK", "ind_niftybanklist.csv"),
    ("NIFTY FIN SERVICE", "ind_niftyfinancelist.csv"),
    ("NIFTY IT", "ind_niftyitlist.csv"),
    ("NIFTY AUTO", "ind_niftyautolist.csv"),
    ("NIFTY FMCG", "ind_niftyfmcglist.csv"),
    ("NIFTY PHARMA", "ind_niftypharmalist.csv"),
    ("NIFTY METAL", "ind_niftymetallist.csv"),
    ("NIFTY REALTY", "ind_niftyrealtylist.csv"),
    ("NIFTY ENERGY", "ind_niftyenergylist.csv"),
    ("NIFTY MEDIA", "ind_niftymedialist.csv"),
    ("NIFTY PSU BANK", "ind_niftypsubanklist.csv"),
    ("NIFTY PVT BANK", "ind_nifty_privatebanklist.csv"),
)


def _in(column: str, values: tuple[str, ...]) -> str:
    return f"{column} IN (" + ", ".join(f"'{v}'" for v in values) + ")"


def _replace_check(table: str, name: str, sql: str) -> None:
    op.drop_constraint(op.f(f"ck_{table}_{name}"), table, type_="check")
    op.create_check_constraint(op.f(f"ck_{table}_{name}"), table, sql)


def upgrade() -> None:
    indices = op.create_table(
        "market_indices",
        sa.Column("name", sa.Text(), nullable=False),
        sa.Column("kite_symbol", sa.Text(), nullable=False),
        sa.Column("constituents_file", sa.Text(), nullable=False),
        sa.Column("instrument_token", sa.BigInteger(), nullable=True),
        sa.Column("member_count", sa.Integer(), server_default="0", nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint(
            "char_length(name) BETWEEN 1 AND 40", name=op.f("ck_market_indices_name")
        ),
        sa.CheckConstraint("member_count >= 0", name=op.f("ck_market_indices_member_count")),
        sa.PrimaryKeyConstraint("name", name=op.f("pk_market_indices")),
        sa.UniqueConstraint("kite_symbol", name=op.f("uq_market_indices_kite_symbol")),
    )
    op.bulk_insert(
        indices,
        [{"name": n, "kite_symbol": n, "constituents_file": f} for n, f in INDICES],
    )

    op.drop_constraint(op.f("ck_universe_indices"), "universe", type_="check")
    op.add_column(
        "universe",
        sa.Column("new_listing", sa.Boolean(), server_default="false", nullable=False),
    )

    op.add_column("data_jobs", sa.Column("summary", sa.Text(), nullable=True))
    op.create_check_constraint(
        op.f("ck_data_jobs_summary"),
        "data_jobs",
        "summary IS NULL OR char_length(summary) <= 500",
    )
    _replace_check("data_jobs", "type", _in("type", NEW_JOB_TYPES))
    _replace_check("data_jobs", "symbols", "type = 'instrument_sync' OR cardinality(symbols) >= 1")
    _replace_check("audit_entries", "action", _in("action", NEW_ACTIONS))


def downgrade() -> None:
    op.execute("DELETE FROM audit_entries WHERE action = 'instrument.clear_new'")
    _replace_check("audit_entries", "action", _in("action", OLD_ACTIONS))
    op.execute("DELETE FROM data_jobs WHERE type = 'instrument_sync'")
    _replace_check("data_jobs", "symbols", "cardinality(symbols) >= 1")
    _replace_check("data_jobs", "type", _in("type", OLD_JOB_TYPES))
    op.drop_constraint(op.f("ck_data_jobs_summary"), "data_jobs", type_="check")
    op.drop_column("data_jobs", "summary")

    op.drop_column("universe", "new_listing")
    old = "ARRAY[" + ", ".join(f"'{i}'" for i in OLD_INDICES) + "]::text[]"
    op.execute(
        "UPDATE universe SET indices = ARRAY(SELECT unnest(indices) INTERSECT "
        f"SELECT unnest({old}))"
    )
    op.create_check_constraint(op.f("ck_universe_indices"), "universe", f"indices <@ {old}")
    op.drop_table("market_indices")
