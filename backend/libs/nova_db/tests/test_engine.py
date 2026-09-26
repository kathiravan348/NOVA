from nova_db import create_db_engine
from sqlalchemy.pool import QueuePool


def test_each_service_keeps_a_small_pool() -> None:
    engine = create_db_engine("postgresql+psycopg://nobody:none@127.0.0.1:1/none")

    pool = engine.pool
    assert isinstance(pool, QueuePool)
    assert pool.size() == 2
    assert pool._max_overflow == 6  # noqa: SLF001  (no public getter)
    engine.dispose()
