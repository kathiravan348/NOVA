from nova_db.migrate import diff, downgrade, upgrade
from nova_db.models import Base
from sqlalchemy import Engine, inspect, text

EXPECTED_TABLES = {
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
    "broker_profiles",
    "rate_limit_rules",
    "data_jobs",
    "audit_entries",
    "instruments",
    "candles",
    "auth_sessions",
    "charge_rates",
    "ticks",
    "universe",
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


def test_super_admin_role_is_seeded(engine: Engine) -> None:
    with engine.connect() as connection:
        roles = connection.execute(text("SELECT id FROM roles")).scalars()

        assert list(roles) == ["super_admin"]


def test_models_match_the_migrated_database(engine: Engine, database_url: str) -> None:
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
