"""Alembic environment: online migrations only, one transaction per run."""

from alembic import context
from nova_db.models import Base
from sqlalchemy import create_engine
from sqlalchemy.pool import NullPool

url = context.config.get_main_option("sqlalchemy.url")
if url is None:
    raise RuntimeError("sqlalchemy.url is not configured (use nova_db.migrate)")

engine = create_engine(url, poolclass=NullPool)
with engine.connect() as connection:
    context.configure(connection=connection, target_metadata=Base.metadata, compare_type=True)
    with context.begin_transaction():
        context.run_migrations()
engine.dispose()
