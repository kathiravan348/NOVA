"""Engine and session factory (sync SQLAlchemy 2 + psycopg 3, D37)."""

from sqlalchemy import Engine, create_engine
from sqlalchemy.orm import Session, sessionmaker

# Each service process keeps at most 2 idle connections and opens at most 8; ten processes stay
# well under Postgres' limit of 100 (compose.yaml, NOVA-098).
POOL_SIZE = 2
MAX_OVERFLOW = 6


def create_db_engine(url: str) -> Engine:
    return create_engine(url, pool_pre_ping=True, pool_size=POOL_SIZE, max_overflow=MAX_OVERFLOW)


def create_session_factory(engine: Engine) -> sessionmaker[Session]:
    return sessionmaker(bind=engine, expire_on_commit=False)
