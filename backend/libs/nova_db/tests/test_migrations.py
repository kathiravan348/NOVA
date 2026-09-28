from nova_db.enums import AUDIT_ACTIONS
from nova_db.migrate import diff, downgrade, upgrade
from nova_db.models import Base
from sqlalchemy import Engine, inspect, text

EXPECTED_TABLES = {
    "approval_requests",
    "users",
    "roles",
    "user_roles",
    "strategies",
    "strategy_versions",
    "backtest_runs",
    "backtest_results",
    "trades",
    "broker_accounts",
    "broker_sessions",
    "broker_kite_apps",
    "broker_profiles",
    "rate_limit_rules",
    "data_jobs",
    "audit_entries",
    "instruments",
    "market_indices",
    "candles",
    "auth_sessions",
    "charge_rates",
    "ticks",
    "universe",
    "recorder_settings",
    "data_job_steps",
    "download_settings",
    "candle_days",
}


def test_upgrade_creates_every_table(engine: Engine) -> None:
    tables = set(inspect(engine).get_table_names())

    assert tables >= EXPECTED_TABLES
    assert set(Base.metadata.tables) == EXPECTED_TABLES


def test_candles_is_a_hypertable(engine: Engine) -> None:
    with engine.connect() as connection:
        names = connection.execute(
            text("SELECT hypertable_name FROM timescaledb_information.hypertables")
        ).scalars()

        assert sorted(names) == ["candles", "ticks"]


def test_head_revision_is_0021(engine: Engine) -> None:
    with engine.connect() as connection:
        head = connection.execute(text("SELECT version_num FROM alembic_version")).scalar_one()

    assert head == "0021"


def test_candles_compression_goes_with_a_downgrade(engine: Engine, database_url: str) -> None:
    query = text(
        "SELECT compression_enabled FROM timescaledb_information.hypertables"
        " WHERE hypertable_name = 'candles'"
    )
    downgrade(database_url, "0012")
    with engine.connect() as connection:
        before = connection.execute(query).scalar_one()
    upgrade(database_url)
    with engine.connect() as connection:
        after = connection.execute(query).scalar_one()

    assert (before, after) == (False, True)


def test_super_admin_role_is_seeded(engine: Engine) -> None:
    with engine.connect() as connection:
        roles = connection.execute(text("SELECT id FROM roles")).scalars()

        assert set(roles) == {"super_admin", "agent"}


def test_models_match_the_migrated_database(engine: Engine, database_url: str) -> None:
    assert diff(database_url) == []


def test_skipped_symbols_column_round_trip(engine: Engine, database_url: str) -> None:
    column = next(
        c for c in inspect(engine).get_columns("backtest_runs") if c["name"] == "skipped_symbols"
    )
    assert column["nullable"] is False
    assert column["default"] == "'{}'::text[]"

    downgrade(database_url, "0020")
    assert "skipped_symbols" not in {
        c["name"] for c in inspect(engine).get_columns("backtest_runs")
    }
    upgrade(database_url)
    assert diff(database_url) == []


def test_downgrade_removes_everything_and_upgrade_restores_it(
    engine: Engine, database_url: str
) -> None:
    downgrade(database_url)
    assert set(inspect(engine).get_table_names()) == {"alembic_version"}

    upgrade(database_url)
    assert set(inspect(engine).get_table_names()) >= EXPECTED_TABLES


def test_the_stock_list_is_seeded(engine: Engine) -> None:
    with engine.connect() as connection:
        symbols = list(connection.execute(text("SELECT symbol FROM universe")).scalars())

    assert len(symbols) == 24 and {"INFY", "TCS", "DABUR"} <= set(symbols)


def test_tick_recording_starts_switched_off(engine: Engine) -> None:
    with engine.connect() as connection:
        rows = connection.execute(text("SELECT id, enabled, symbols FROM recorder_settings")).all()

    assert [tuple(row) for row in rows] == [(1, False, [])]


def test_kite_app_details_move_from_the_profile_to_each_account(
    engine: Engine, database_url: str
) -> None:
    downgrade(database_url, "0007")
    with engine.begin() as connection:
        connection.execute(text("TRUNCATE broker_accounts, broker_profiles CASCADE"))
        connection.execute(
            text(
                "INSERT INTO broker_profiles (broker, name, api, plan, api_key_last4, redirect_url,"
                " static_ip, session_rule) VALUES ('zerodha', 'Zerodha', 'Kite Connect v3', 'Paid',"
                " 'AB12', 'http://localhost', '203.0.113.5', 'Daily login')"
            )
        )
        connection.execute(
            text(
                "INSERT INTO broker_accounts (id, broker, label, client_id)"
                " VALUES ('brk_1', 'zerodha', 'Main', 'AB1234')"
            )
        )
    upgrade(database_url)
    with engine.begin() as connection:
        rows = connection.execute(
            text("SELECT account_id, api_key, plan, static_ip FROM broker_kite_apps")
        ).all()
        columns = {c["name"] for c in inspect(connection).get_columns("broker_profiles")}
        connection.execute(text("TRUNCATE broker_accounts, broker_profiles CASCADE"))

    assert [tuple(row) for row in rows] == [("brk_1", None, "Paid", "203.0.113.5")]
    assert "plan" not in columns and "api_key_last4" not in columns


def test_indices_are_seeded_and_the_stock_list_keeps_its_indices(engine: Engine) -> None:
    with engine.connect() as connection:
        names = list(connection.execute(text("SELECT name FROM market_indices")).scalars())
        infy = connection.execute(
            text("SELECT indices, new_listing FROM universe WHERE symbol = 'INFY'")
        ).one()

    assert len(names) == 19 and {"NIFTY 50", "NIFTY IT", "NIFTY MIDCAP 100"} <= set(names)
    assert "NIFTY 50" in infy.indices and infy.new_listing is False


def _job_trigger_exists(engine: Engine) -> bool:
    with engine.connect() as connection:
        found = connection.execute(
            text("SELECT 1 FROM pg_trigger WHERE tgname = 'data_jobs_notify'")
        ).first()
    return found is not None


def test_data_job_changes_are_announced_until_downgraded(engine: Engine, database_url: str) -> None:
    assert _job_trigger_exists(engine)

    downgrade(database_url, "0009")
    assert not _job_trigger_exists(engine)

    upgrade(database_url)
    assert _job_trigger_exists(engine)


def test_download_settings_start_slow(engine: Engine) -> None:
    with engine.connect() as connection:
        rows = connection.execute(text("SELECT id, market_hours_mode FROM download_settings")).all()

    assert [tuple(row) for row in rows] == [(1, "slow")]


def test_paused_jobs_become_cancelled_and_drafts_go_on_downgrade(
    engine: Engine, database_url: str
) -> None:
    with engine.begin() as connection:
        connection.execute(text("TRUNCATE data_jobs CASCADE"))
        connection.execute(
            text(
                "INSERT INTO data_jobs (id, type, status, exchange, segment, symbols, timeframe,"
                " date_from, date_to, mode, plan, expires_at) VALUES"
                " ('job_d', 'historical_download', 'draft', 'NSE', 'equity_delivery', '{INFY}',"
                " '1d', '2025-01-01', '2025-12-31', 'skip_existing', '{}',"
                " now() + interval '1 day'),"
                " ('job_p', 'historical_download', 'paused', 'NSE', 'equity_delivery', '{INFY}',"
                " '1d', '2025-01-01', '2025-12-31', 'overwrite', NULL, NULL)"
            )
        )
    downgrade(database_url, "0010")
    with engine.begin() as connection:
        rows = connection.execute(text("SELECT id, status FROM data_jobs")).all()
        connection.execute(text("TRUNCATE data_jobs CASCADE"))
    upgrade(database_url)

    assert [tuple(row) for row in rows] == [("job_p", "cancelled")]


def _trigger_events(engine: Engine) -> str:
    with engine.connect() as connection:
        definition = connection.execute(
            text("SELECT pg_get_triggerdef(oid) FROM pg_trigger WHERE tgname = 'data_jobs_notify'")
        ).scalar_one()
    return str(definition)


def test_deletes_are_announced_until_downgraded(engine: Engine, database_url: str) -> None:
    assert "OR DELETE" in _trigger_events(engine)

    downgrade(database_url, "0011")
    assert "OR DELETE" not in _trigger_events(engine)

    upgrade(database_url)
    assert "OR DELETE" in _trigger_events(engine)


def _log_strategy_delete(engine: Engine) -> None:
    with engine.begin() as connection:
        connection.execute(
            text(
                "INSERT INTO audit_entries (id, actor_name, action, summary)"
                " VALUES ('aud_del', 'Owner', 'strategy.delete', 'Deleted strategy X')"
            )
        )


def test_strategy_delete_is_an_audit_action_until_downgraded(
    engine: Engine, database_url: str
) -> None:
    _log_strategy_delete(engine)

    downgrade(database_url, "0015")
    with engine.connect() as connection:
        left = connection.execute(
            text("SELECT count(*) FROM audit_entries WHERE action = 'strategy.delete'")
        ).scalar_one()
    assert left == 0

    upgrade(database_url)
    _log_strategy_delete(engine)
    with engine.begin() as connection:
        connection.execute(text("DELETE FROM audit_entries WHERE id = 'aud_del'"))


def test_candle_days_are_filled_from_the_stored_candles(engine: Engine, database_url: str) -> None:
    """D63: 0017 counts bars per IST day of each 1m and 1d series once; others are skipped."""
    rows = [
        ("RELIANCE", "1m", "2026-09-24 03:45+00"),
        ("RELIANCE", "1m", "2026-09-24 03:46+00"),
        ("RELIANCE", "1m", "2026-09-25 03:45+00"),
        ("RELIANCE", "1d", "2026-09-24 18:30+00"),  # 00:00 IST on 25 Sep
        ("RELIANCE", "5m", "2026-09-24 03:45+00"),
    ]
    with engine.begin() as connection:
        for symbol, timeframe, ts in rows:
            connection.execute(
                text("INSERT INTO candles VALUES ('NSE', :s, :t, :ts, 100, 110, 90, 105, 10)"),
                {"s": symbol, "t": timeframe, "ts": ts},
            )
    try:
        downgrade(database_url, "0016")
        upgrade(database_url)
        with engine.connect() as connection:
            days = connection.execute(
                text("SELECT timeframe, day::text, bars FROM candle_days ORDER BY 1, 2")
            ).all()
        assert [tuple(d) for d in days] == [
            ("1d", "2026-09-25", 1),
            ("1m", "2026-09-24", 2),
            ("1m", "2026-09-25", 1),
        ]
    finally:
        with engine.begin() as connection:
            connection.execute(text("DELETE FROM candles WHERE symbol = 'RELIANCE'"))
            connection.execute(text("DELETE FROM candle_days WHERE symbol = 'RELIANCE'"))


def test_agent_audits_are_removed_on_downgrade(engine: Engine, database_url: str) -> None:
    insert = text(
        "INSERT INTO audit_entries (id, actor_name, action, summary, target_type, target_id)"
        " VALUES (:action, 'Agent', :action, 'Test', 'approval_request', 'apr_test')"
    )
    with engine.begin() as connection:
        for action in AUDIT_ACTIONS:
            if action.startswith(("agent.", "approval.")):
                connection.execute(insert, {"action": action})
    downgrade(database_url, "0019")
    with engine.connect() as connection:
        assert "approval_requests" not in inspect(connection).get_table_names()
        assert (
            connection.execute(
                text("SELECT id FROM audit_entries WHERE target_type = 'approval_request'")
            ).first()
            is None
        )
    upgrade(database_url)
    assert diff(database_url) == []
