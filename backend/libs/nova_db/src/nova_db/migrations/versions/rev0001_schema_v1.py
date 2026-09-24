"""Schema v1: domain tables behind the frozen contracts, candles as a hypertable (D37).

Revision ID: 0001
Revises:
Create Date: 2026-09-24

Drafted with Alembic autogenerate from `nova_db.models`, then reviewed and extended by hand
(TimescaleDB, hypertable, role seed). `test_migrations.py` proves models and migration match.
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0001"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS timescaledb")
    op.create_table(
        "broker_accounts",
        sa.Column("id", sa.Text(), nullable=False),
        sa.Column("broker", sa.Text(), nullable=False),
        sa.Column("label", sa.Text(), nullable=False),
        sa.Column("client_id", sa.Text(), nullable=False),
        sa.Column("enabled", sa.Boolean(), server_default="true", nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint("broker IN ('zerodha')", name=op.f("ck_broker_accounts_broker")),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_broker_accounts")),
        sa.UniqueConstraint("client_id", name=op.f("uq_broker_accounts_client_id")),
    )
    op.create_table(
        "broker_profiles",
        sa.Column("broker", sa.Text(), nullable=False),
        sa.Column("name", sa.Text(), nullable=False),
        sa.Column("api", sa.Text(), nullable=False),
        sa.Column("plan", sa.Text(), nullable=False),
        sa.Column("subscription_renews_on", sa.Date(), nullable=True),
        sa.Column("api_key_last4", sa.Text(), nullable=False),
        sa.Column("redirect_url", sa.Text(), nullable=False),
        sa.Column("postback_url", sa.Text(), nullable=True),
        sa.Column("static_ip", sa.Text(), nullable=True),
        sa.Column("session_rule", sa.Text(), nullable=False),
        sa.Column(
            "links", postgresql.JSONB(astext_type=sa.Text()), server_default="[]", nullable=False
        ),
        sa.CheckConstraint(
            "api_key_last4 ~ '^[A-Za-z0-9]{4}$'", name=op.f("ck_broker_profiles_api_key_last4")
        ),
        sa.CheckConstraint("broker IN ('zerodha')", name=op.f("ck_broker_profiles_broker")),
        sa.PrimaryKeyConstraint("broker", name=op.f("pk_broker_profiles")),
    )
    op.create_table(
        "candles",
        sa.Column("exchange", sa.Text(), nullable=False),
        sa.Column("symbol", sa.Text(), nullable=False),
        sa.Column("timeframe", sa.Text(), nullable=False),
        sa.Column("ts", sa.DateTime(timezone=True), nullable=False),
        sa.Column("open_paise", sa.BigInteger(), nullable=False),
        sa.Column("high_paise", sa.BigInteger(), nullable=False),
        sa.Column("low_paise", sa.BigInteger(), nullable=False),
        sa.Column("close_paise", sa.BigInteger(), nullable=False),
        sa.Column("volume", sa.BigInteger(), nullable=False),
        sa.CheckConstraint(
            "timeframe IN ('1m', '3m', '5m', '15m', '30m', '1h', '1d')",
            name=op.f("ck_candles_timeframe"),
        ),
        sa.CheckConstraint(
            "open_paise > 0 AND low_paise > 0 AND volume >= 0 AND high_paise >= GREATEST(open_paise, close_paise) AND low_paise <= LEAST(open_paise, close_paise)",
            name=op.f("ck_candles_ohlc"),
        ),
        sa.PrimaryKeyConstraint("exchange", "symbol", "timeframe", "ts", name=op.f("pk_candles")),
    )
    # The primary key already starts with the lookup columns and includes ts: no extra default index.
    op.execute(
        "SELECT create_hypertable('candles', by_range('ts', INTERVAL '30 days'),"
        " create_default_indexes => false)"
    )
    op.create_table(
        "data_jobs",
        sa.Column("id", sa.Text(), nullable=False),
        sa.Column("type", sa.Text(), nullable=False),
        sa.Column("status", sa.Text(), nullable=False),
        sa.Column("exchange", sa.Text(), nullable=False),
        sa.Column("segment", sa.Text(), nullable=False),
        sa.Column("symbols", postgresql.ARRAY(sa.Text()), nullable=False),
        sa.Column("timeframe", sa.Text(), nullable=True),
        sa.Column("date_from", sa.Date(), nullable=True),
        sa.Column("date_to", sa.Date(), nullable=True),
        sa.Column(
            "progress_percent", sa.Numeric(precision=5, scale=2), server_default="0", nullable=False
        ),
        sa.Column("rows_written", sa.BigInteger(), server_default="0", nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("finished_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("error", sa.Text(), nullable=True),
        sa.CheckConstraint(
            "error IS NULL OR status = 'failed'", name=op.f("ck_data_jobs_error_only_failed")
        ),
        sa.CheckConstraint("exchange IN ('NSE', 'NFO')", name=op.f("ck_data_jobs_exchange")),
        sa.CheckConstraint(
            "segment IN ('equity_delivery', 'equity_intraday', 'futures', 'options')",
            name=op.f("ck_data_jobs_segment"),
        ),
        sa.CheckConstraint(
            "status <> 'completed' OR (progress_percent = 100 AND finished_at IS NOT NULL)",
            name=op.f("ck_data_jobs_completed"),
        ),
        sa.CheckConstraint(
            "status <> 'queued' OR (started_at IS NULL AND finished_at IS NULL)",
            name=op.f("ck_data_jobs_queued"),
        ),
        sa.CheckConstraint(
            "status IN ('queued', 'running', 'completed', 'failed', 'cancelled')",
            name=op.f("ck_data_jobs_status"),
        ),
        sa.CheckConstraint(
            "timeframe IS NULL OR timeframe IN ('1m', '3m', '5m', '15m', '30m', '1h', '1d')",
            name=op.f("ck_data_jobs_timeframe"),
        ),
        sa.CheckConstraint(
            "type <> 'historical_download' OR (timeframe IS NOT NULL AND date_from IS NOT NULL AND date_to IS NOT NULL)",
            name=op.f("ck_data_jobs_download_needs_period"),
        ),
        sa.CheckConstraint(
            "type <> 'tick_record' OR timeframe IS NULL",
            name=op.f("ck_data_jobs_ticks_no_timeframe"),
        ),
        sa.CheckConstraint(
            "type IN ('historical_download', 'tick_record', 'archive')",
            name=op.f("ck_data_jobs_type"),
        ),
        sa.CheckConstraint(
            "(date_from IS NULL AND date_to IS NULL) OR (date_from IS NOT NULL AND date_to IS NOT NULL AND date_from <= date_to)",
            name=op.f("ck_data_jobs_period"),
        ),
        sa.CheckConstraint("cardinality(symbols) >= 1", name=op.f("ck_data_jobs_symbols")),
        sa.CheckConstraint(
            "progress_percent BETWEEN 0 AND 100 AND rows_written >= 0",
            name=op.f("ck_data_jobs_progress"),
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_data_jobs")),
    )
    op.create_index(
        op.f("ix_data_jobs_created_at_id"), "data_jobs", ["created_at", "id"], unique=False
    )
    op.create_table(
        "instruments",
        sa.Column("exchange", sa.Text(), nullable=False),
        sa.Column("symbol", sa.Text(), nullable=False),
        sa.Column("name", sa.Text(), nullable=False),
        sa.Column("segment", sa.Text(), nullable=False),
        sa.Column("sector", sa.Text(), nullable=False),
        sa.Column("indices", postgresql.ARRAY(sa.Text()), server_default="{}", nullable=False),
        sa.Column("lot_size", sa.Integer(), nullable=True),
        sa.Column("instrument_token", sa.BigInteger(), nullable=True),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint("exchange IN ('NSE', 'NFO')", name=op.f("ck_instruments_exchange")),
        sa.CheckConstraint(
            "segment IN ('equity_delivery', 'equity_intraday', 'futures', 'options')",
            name=op.f("ck_instruments_segment"),
        ),
        sa.CheckConstraint(
            "lot_size IS NULL OR lot_size > 0", name=op.f("ck_instruments_lot_size")
        ),
        sa.PrimaryKeyConstraint("exchange", "symbol", name=op.f("pk_instruments")),
        sa.UniqueConstraint("instrument_token", name=op.f("uq_instruments_instrument_token")),
    )
    op.create_table(
        "roles",
        sa.Column("id", sa.Text(), nullable=False),
        sa.Column("name", sa.Text(), nullable=False),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_roles")),
    )
    op.create_table(
        "strategies",
        sa.Column("id", sa.Text(), nullable=False),
        sa.Column("name", sa.Text(), nullable=False),
        sa.Column("description", sa.Text(), server_default="", nullable=False),
        sa.Column("status", sa.Text(), nullable=False),
        sa.Column("latest_version", sa.Integer(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint(
            "status IN ('draft', 'active', 'archived')", name=op.f("ck_strategies_status")
        ),
        sa.CheckConstraint("latest_version >= 1", name=op.f("ck_strategies_latest_version")),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_strategies")),
    )
    op.create_table(
        "users",
        sa.Column("id", sa.Text(), nullable=False),
        sa.Column("name", sa.Text(), nullable=False),
        sa.Column("email", sa.Text(), nullable=False),
        sa.Column("password_hash", sa.Text(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("last_login_at", sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_users")),
        sa.UniqueConstraint("email", name=op.f("uq_users_email")),
    )
    op.create_table(
        "audit_entries",
        sa.Column("id", sa.Text(), nullable=False),
        sa.Column(
            "at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False
        ),
        sa.Column("actor_id", sa.Text(), nullable=True),
        sa.Column("actor_name", sa.Text(), nullable=False),
        sa.Column("action", sa.Text(), nullable=False),
        sa.Column("target_type", sa.Text(), nullable=True),
        sa.Column("target_id", sa.Text(), nullable=True),
        sa.Column("summary", sa.Text(), nullable=False),
        sa.Column("ip", sa.Text(), nullable=True),
        sa.CheckConstraint(
            "action IN ('auth.login', 'auth.logout', 'broker.login', 'broker.session_expired', 'broker.rate_limit_update', 'strategy.create', 'strategy.update', 'backtest.run', 'data_job.create', 'data_job.cancel', 'settings.update')",
            name=op.f("ck_audit_entries_action"),
        ),
        sa.CheckConstraint(
            "target_type IS NULL OR target_type IN ('user', 'broker_account', 'strategy', 'backtest', 'data_job', 'settings')",
            name=op.f("ck_audit_entries_target_type"),
        ),
        sa.CheckConstraint(
            "(target_type IS NULL) = (target_id IS NULL)", name=op.f("ck_audit_entries_target_pair")
        ),
        sa.ForeignKeyConstraint(
            ["actor_id"],
            ["users.id"],
            name=op.f("fk_audit_entries_actor_id_users"),
            ondelete="SET NULL",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_audit_entries")),
    )
    op.create_index(op.f("ix_audit_entries_at_id"), "audit_entries", ["at", "id"], unique=False)
    op.create_table(
        "broker_sessions",
        sa.Column("account_id", sa.Text(), nullable=False),
        sa.Column("access_token_encrypted", sa.LargeBinary(), nullable=True),
        sa.Column("logged_in_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint(
            "(access_token_encrypted IS NULL) = (logged_in_at IS NULL) AND (logged_in_at IS NULL) = (expires_at IS NULL)",
            name=op.f("ck_broker_sessions_login_triple"),
        ),
        sa.CheckConstraint(
            "logged_in_at < expires_at", name=op.f("ck_broker_sessions_expiry_after_login")
        ),
        sa.ForeignKeyConstraint(
            ["account_id"],
            ["broker_accounts.id"],
            name=op.f("fk_broker_sessions_account_id_broker_accounts"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("account_id", name=op.f("pk_broker_sessions")),
    )
    op.create_table(
        "rate_limit_rules",
        sa.Column("account_id", sa.Text(), nullable=False),
        sa.Column("endpoint", sa.Text(), nullable=False),
        sa.Column("rate_window", sa.Text(), nullable=False),
        sa.Column("broker_limit", sa.Integer(), nullable=False),
        sa.Column("nova_limit", sa.Integer(), nullable=False),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint(
            "endpoint IN ('quote', 'historical', 'orders', 'other')",
            name=op.f("ck_rate_limit_rules_endpoint"),
        ),
        sa.CheckConstraint(
            "rate_window IN ('second', 'minute', 'day')",
            name=op.f("ck_rate_limit_rules_rate_window"),
        ),
        sa.CheckConstraint(
            "nova_limit > 0 AND nova_limit <= broker_limit",
            name=op.f("ck_rate_limit_rules_nova_limit"),
        ),
        sa.ForeignKeyConstraint(
            ["account_id"],
            ["broker_accounts.id"],
            name=op.f("fk_rate_limit_rules_account_id_broker_accounts"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint(
            "account_id", "endpoint", "rate_window", name=op.f("pk_rate_limit_rules")
        ),
    )
    op.create_table(
        "strategy_versions",
        sa.Column("strategy_id", sa.Text(), nullable=False),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("note", sa.Text(), server_default="", nullable=False),
        sa.Column("spec", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.CheckConstraint("version >= 1", name=op.f("ck_strategy_versions_version")),
        sa.ForeignKeyConstraint(
            ["strategy_id"],
            ["strategies.id"],
            name=op.f("fk_strategy_versions_strategy_id_strategies"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("strategy_id", "version", name=op.f("pk_strategy_versions")),
    )
    op.create_table(
        "user_roles",
        sa.Column("user_id", sa.Text(), nullable=False),
        sa.Column("role_id", sa.Text(), nullable=False),
        sa.ForeignKeyConstraint(
            ["role_id"], ["roles.id"], name=op.f("fk_user_roles_role_id_roles")
        ),
        sa.ForeignKeyConstraint(
            ["user_id"], ["users.id"], name=op.f("fk_user_roles_user_id_users"), ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("user_id", "role_id", name=op.f("pk_user_roles")),
    )
    op.create_table(
        "backtest_runs",
        sa.Column("id", sa.Text(), nullable=False),
        sa.Column("strategy_id", sa.Text(), nullable=False),
        sa.Column("strategy_version", sa.Integer(), nullable=False),
        sa.Column("name", sa.Text(), nullable=False),
        sa.Column("universe", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("status", sa.Text(), nullable=False),
        sa.Column("date_from", sa.Date(), nullable=False),
        sa.Column("date_to", sa.Date(), nullable=False),
        sa.Column("initial_capital_paise", sa.BigInteger(), nullable=False),
        sa.Column("benchmark", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("finished_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("error", sa.Text(), nullable=True),
        sa.CheckConstraint(
            "benchmark IS NULL OR benchmark IN ('NIFTY 50')",
            name=op.f("ck_backtest_runs_benchmark"),
        ),
        sa.CheckConstraint(
            "error IS NULL OR status = 'failed'", name=op.f("ck_backtest_runs_error_only_failed")
        ),
        sa.CheckConstraint(
            "status IN ('queued', 'running', 'completed', 'failed')",
            name=op.f("ck_backtest_runs_status"),
        ),
        sa.CheckConstraint("date_from <= date_to", name=op.f("ck_backtest_runs_period")),
        sa.CheckConstraint(
            "initial_capital_paise > 0", name=op.f("ck_backtest_runs_initial_capital")
        ),
        sa.ForeignKeyConstraint(
            ["strategy_id", "strategy_version"],
            ["strategy_versions.strategy_id", "strategy_versions.version"],
            name=op.f("fk_backtest_runs_strategy_id_strategy_version_strategy_versions"),
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_backtest_runs")),
    )
    op.create_index(
        op.f("ix_backtest_runs_created_at_id"), "backtest_runs", ["created_at", "id"], unique=False
    )
    op.create_index(
        op.f("ix_backtest_runs_strategy_id_created_at_id"),
        "backtest_runs",
        ["strategy_id", "created_at", "id"],
        unique=False,
    )
    op.create_table(
        "backtest_results",
        sa.Column("run_id", sa.Text(), nullable=False),
        sa.Column("gross_pnl_paise", sa.BigInteger(), nullable=False),
        sa.Column("charges_paise", sa.BigInteger(), nullable=False),
        sa.Column("net_pnl_paise", sa.BigInteger(), nullable=False),
        sa.Column("return_percent", sa.Numeric(precision=12, scale=4), nullable=False),
        sa.Column("cagr_percent", sa.Numeric(precision=12, scale=4), nullable=False),
        sa.Column("max_drawdown_percent", sa.Numeric(precision=12, scale=4), nullable=False),
        sa.Column("sharpe", sa.Numeric(precision=12, scale=4), nullable=False),
        sa.Column("win_rate_percent", sa.Numeric(precision=12, scale=4), nullable=False),
        sa.Column("trade_count", sa.Integer(), nullable=False),
        sa.Column("win_count", sa.Integer(), nullable=False),
        sa.Column("loss_count", sa.Integer(), nullable=False),
        sa.Column("equity_curve", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("by_symbol", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.CheckConstraint("charges_paise >= 0", name=op.f("ck_backtest_results_charges")),
        sa.CheckConstraint("max_drawdown_percent <= 0", name=op.f("ck_backtest_results_drawdown")),
        sa.CheckConstraint(
            "net_pnl_paise = gross_pnl_paise - charges_paise",
            name=op.f("ck_backtest_results_net_pnl"),
        ),
        sa.CheckConstraint(
            "win_count >= 0 AND loss_count >= 0 AND win_count + loss_count <= trade_count",
            name=op.f("ck_backtest_results_counts"),
        ),
        sa.CheckConstraint(
            "win_rate_percent BETWEEN 0 AND 100", name=op.f("ck_backtest_results_win_rate")
        ),
        sa.ForeignKeyConstraint(
            ["run_id"],
            ["backtest_runs.id"],
            name=op.f("fk_backtest_results_run_id_backtest_runs"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("run_id", name=op.f("pk_backtest_results")),
    )
    op.create_table(
        "trades",
        sa.Column("id", sa.Text(), nullable=False),
        sa.Column("run_id", sa.Text(), nullable=False),
        sa.Column("symbol", sa.Text(), nullable=False),
        sa.Column("exchange", sa.Text(), nullable=False),
        sa.Column("segment", sa.Text(), nullable=False),
        sa.Column("side", sa.Text(), nullable=False),
        sa.Column("qty", sa.Integer(), nullable=False),
        sa.Column("entry_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("entry_price_paise", sa.BigInteger(), nullable=False),
        sa.Column("exit_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("exit_price_paise", sa.BigInteger(), nullable=True),
        sa.Column("gross_pnl_paise", sa.BigInteger(), nullable=False),
        sa.Column("brokerage_paise", sa.BigInteger(), nullable=False),
        sa.Column("stt_paise", sa.BigInteger(), nullable=False),
        sa.Column("exchange_txn_paise", sa.BigInteger(), nullable=False),
        sa.Column("sebi_fee_paise", sa.BigInteger(), nullable=False),
        sa.Column("stamp_duty_paise", sa.BigInteger(), nullable=False),
        sa.Column("gst_paise", sa.BigInteger(), nullable=False),
        sa.Column("dp_paise", sa.BigInteger(), nullable=False),
        sa.Column("charges_total_paise", sa.BigInteger(), nullable=False),
        sa.Column("net_pnl_paise", sa.BigInteger(), nullable=False),
        sa.CheckConstraint("exchange IN ('NSE', 'NFO')", name=op.f("ck_trades_exchange")),
        sa.CheckConstraint(
            "segment IN ('equity_delivery', 'equity_intraday', 'futures', 'options')",
            name=op.f("ck_trades_segment"),
        ),
        sa.CheckConstraint("side IN ('buy', 'sell')", name=op.f("ck_trades_side")),
        sa.CheckConstraint(
            "(exit_at IS NULL AND exit_price_paise IS NULL) OR (exit_at IS NOT NULL AND exit_price_paise IS NOT NULL AND exit_price_paise > 0)",
            name=op.f("ck_trades_exit_pair"),
        ),
        sa.CheckConstraint(
            "brokerage_paise >= 0 AND stt_paise >= 0 AND exchange_txn_paise >= 0 AND sebi_fee_paise >= 0 AND stamp_duty_paise >= 0 AND gst_paise >= 0 AND dp_paise >= 0",
            name=op.f("ck_trades_charges"),
        ),
        sa.CheckConstraint(
            "charges_total_paise = brokerage_paise + stt_paise + exchange_txn_paise + sebi_fee_paise + stamp_duty_paise + gst_paise + dp_paise",
            name=op.f("ck_trades_charges_total"),
        ),
        sa.CheckConstraint(
            "net_pnl_paise = gross_pnl_paise - charges_total_paise", name=op.f("ck_trades_net_pnl")
        ),
        sa.CheckConstraint("qty > 0 AND entry_price_paise > 0", name=op.f("ck_trades_entry")),
        sa.ForeignKeyConstraint(
            ["run_id"],
            ["backtest_runs.id"],
            name=op.f("fk_trades_run_id_backtest_runs"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_trades")),
    )
    op.create_index(
        op.f("ix_trades_run_id_entry_at_id"), "trades", ["run_id", "entry_at", "id"], unique=False
    )

    roles = sa.table("roles", sa.column("id", sa.Text()), sa.column("name", sa.Text()))
    op.bulk_insert(roles, [{"id": "super_admin", "name": "Super admin"}])


def downgrade() -> None:
    # The timescaledb extension stays installed: other databases on the server may use it.
    op.drop_index(op.f("ix_trades_run_id_entry_at_id"), table_name="trades")
    op.drop_table("trades")
    op.drop_table("backtest_results")
    op.drop_index(op.f("ix_backtest_runs_strategy_id_created_at_id"), table_name="backtest_runs")
    op.drop_index(op.f("ix_backtest_runs_created_at_id"), table_name="backtest_runs")
    op.drop_table("backtest_runs")
    op.drop_table("user_roles")
    op.drop_table("strategy_versions")
    op.drop_table("rate_limit_rules")
    op.drop_table("broker_sessions")
    op.drop_index(op.f("ix_audit_entries_at_id"), table_name="audit_entries")
    op.drop_table("audit_entries")
    op.drop_table("users")
    op.drop_table("strategies")
    op.drop_table("roles")
    op.drop_table("instruments")
    op.drop_index(op.f("ix_data_jobs_created_at_id"), table_name="data_jobs")
    op.drop_table("data_jobs")
    op.drop_table("candles")
    op.drop_table("broker_profiles")
    op.drop_table("broker_accounts")
