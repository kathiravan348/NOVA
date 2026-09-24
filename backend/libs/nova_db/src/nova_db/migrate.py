"""Run Alembic migrations programmatically (used by `python -m nova_db` and tests)."""

from typing import Any

from alembic import command
from alembic.autogenerate import compare_metadata
from alembic.config import Config
from alembic.migration import MigrationContext
from sqlalchemy import create_engine
from sqlalchemy.pool import NullPool

from nova_db.models import Base


def alembic_config(database_url: str) -> Config:
    config = Config()
    config.set_main_option("script_location", "nova_db:migrations")
    # ConfigParser treats % as interpolation; URL-encoded passwords contain it.
    config.set_main_option("sqlalchemy.url", database_url.replace("%", "%%"))
    return config


def upgrade(database_url: str, revision: str = "head") -> None:
    command.upgrade(alembic_config(database_url), revision)


def downgrade(database_url: str, revision: str = "base") -> None:
    command.downgrade(alembic_config(database_url), revision)


def diff(database_url: str) -> list[Any]:
    """Differences between the models and a migrated database; empty when they match.

    Any: Alembic returns loosely typed diff tuples.
    """
    engine = create_engine(database_url, poolclass=NullPool)
    try:
        with engine.connect() as connection:
            context = MigrationContext.configure(connection, opts={"compare_type": True})
            return list(compare_metadata(context, Base.metadata))
    finally:
        engine.dispose()
