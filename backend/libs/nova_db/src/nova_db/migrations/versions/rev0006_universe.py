"""The stock list moves from `universe.csv` to the `universe` table, edited in Relay (D54).

Revision ID: 0006
Revises: 0005
Create Date: 2026-09-25
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0006"
down_revision: str | None = "0005"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

# Frozen copies: a migration never reads enums.py or the app's data, which keep changing.
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
    "settings.update",
)
NEW_ACTIONS = (
    *OLD_ACTIONS[:11],
    "instrument.add",
    "instrument.update",
    "instrument.remove",
    "instrument.sync",
    *OLD_ACTIONS[11:],
)
OLD_TARGETS = ("user", "broker_account", "strategy", "backtest", "data_job", "settings")
NEW_TARGETS = (*OLD_TARGETS, "instrument")

# The 24 stocks of `universe.csv` as it was before NOVA-074 (symbol, name, sector, indices).
SEED: tuple[tuple[str, str, str, tuple[str, ...]], ...] = (
    ("RELIANCE", "Reliance Industries", "Energy", ("NIFTY 50",)),
    ("TCS", "Tata Consultancy Services", "Information Technology", ("NIFTY 50",)),
    ("INFY", "Infosys", "Information Technology", ("NIFTY 50",)),
    ("HDFCBANK", "HDFC Bank", "Financial Services", ("NIFTY 50", "NIFTY BANK")),
    ("ICICIBANK", "ICICI Bank", "Financial Services", ("NIFTY 50", "NIFTY BANK")),
    ("SBIN", "State Bank of India", "Financial Services", ("NIFTY 50", "NIFTY BANK")),
    ("KOTAKBANK", "Kotak Mahindra Bank", "Financial Services", ("NIFTY 50", "NIFTY BANK")),
    ("AXISBANK", "Axis Bank", "Financial Services", ("NIFTY 50", "NIFTY BANK")),
    ("ITC", "ITC", "Consumer Goods", ("NIFTY 50",)),
    ("LT", "Larsen & Toubro", "Construction", ("NIFTY 50",)),
    ("BHARTIARTL", "Bharti Airtel", "Telecommunication", ("NIFTY 50",)),
    ("HINDUNILVR", "Hindustan Unilever", "Consumer Goods", ("NIFTY 50",)),
    ("BAJFINANCE", "Bajaj Finance", "Financial Services", ("NIFTY 50",)),
    ("MARUTI", "Maruti Suzuki India", "Automobile", ("NIFTY 50",)),
    ("SUNPHARMA", "Sun Pharmaceutical Industries", "Healthcare", ("NIFTY 50",)),
    ("TITAN", "Titan Company", "Consumer Goods", ("NIFTY 50",)),
    ("ASIANPAINT", "Asian Paints", "Consumer Goods", ("NIFTY 50",)),
    ("WIPRO", "Wipro", "Information Technology", ("NIFTY 50",)),
    ("HCLTECH", "HCL Technologies", "Information Technology", ("NIFTY 50",)),
    ("NTPC", "NTPC", "Utilities", ("NIFTY 50",)),
    ("DMART", "Avenue Supermarts (DMart)", "Consumer Services", ("NIFTY NEXT 50",)),
    ("PIDILITIND", "Pidilite Industries", "Chemicals", ("NIFTY NEXT 50",)),
    ("HAVELLS", "Havells India", "Consumer Goods", ("NIFTY NEXT 50",)),
    ("DABUR", "Dabur India", "Consumer Goods", ("NIFTY NEXT 50",)),
)


def _check(name: str, sql: str) -> None:
    op.drop_constraint(op.f(f"ck_audit_entries_{name}"), "audit_entries", type_="check")
    op.create_check_constraint(op.f(f"ck_audit_entries_{name}"), "audit_entries", sql)


def _audit_lists(actions: tuple[str, ...], targets: tuple[str, ...]) -> None:
    _check("action", "action IN (" + ", ".join(f"'{a}'" for a in actions) + ")")
    _check(
        "target_type",
        "target_type IS NULL OR target_type IN (" + ", ".join(f"'{t}'" for t in targets) + ")",
    )


def upgrade() -> None:
    universe = op.create_table(
        "universe",
        sa.Column("exchange", sa.Text(), nullable=False),
        sa.Column("symbol", sa.Text(), nullable=False),
        sa.Column("name", sa.Text(), nullable=False),
        sa.Column("sector", sa.Text(), nullable=False),
        sa.Column("indices", postgresql.ARRAY(sa.Text()), server_default="{}", nullable=False),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.CheckConstraint("exchange IN ('NSE', 'NFO')", name=op.f("ck_universe_exchange")),
        sa.CheckConstraint(
            "indices <@ ARRAY['NIFTY 50', 'NIFTY BANK', 'NIFTY NEXT 50']::text[]",
            name=op.f("ck_universe_indices"),
        ),
        sa.PrimaryKeyConstraint("exchange", "symbol", name=op.f("pk_universe")),
    )
    op.bulk_insert(
        universe,
        [
            {"exchange": "NSE", "symbol": s, "name": n, "sector": sec, "indices": list(idx)}
            for s, n, sec, idx in SEED
        ],
    )
    _audit_lists(NEW_ACTIONS, NEW_TARGETS)


def downgrade() -> None:
    op.execute(
        "DELETE FROM audit_entries WHERE action LIKE 'instrument.%' OR target_type = 'instrument'"
    )
    _audit_lists(OLD_ACTIONS, OLD_TARGETS)
    op.drop_table("universe")
