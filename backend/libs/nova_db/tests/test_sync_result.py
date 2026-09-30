from nova_db.migrate import diff, downgrade, upgrade
from sqlalchemy import Engine, inspect


def test_sync_result_migration_round_trip(engine: Engine, database_url: str) -> None:
    assert "sync_result" in {column["name"] for column in inspect(engine).get_columns("data_jobs")}
    downgrade(database_url, "0023")
    try:
        assert "sync_result" not in {
            column["name"] for column in inspect(engine).get_columns("data_jobs")
        }
    finally:
        upgrade(database_url)
    assert diff(database_url) == []
