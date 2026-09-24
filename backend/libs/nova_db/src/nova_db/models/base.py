"""Declarative base: naming convention for constraints and column type defaults (D17, D37)."""

from datetime import date, datetime
from decimal import Decimal
from typing import Any

from sqlalchemy import CheckConstraint, Date, DateTime, MetaData, Numeric, Text, func
from sqlalchemy.dialects.postgresql import ARRAY, JSONB
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column

from nova_db.enums import sql_in

NAMING_CONVENTION = {
    "ix": "ix_%(table_name)s_%(column_0_N_name)s",
    "uq": "uq_%(table_name)s_%(column_0_N_name)s",
    "ck": "ck_%(table_name)s_%(constraint_name)s",
    "fk": "fk_%(table_name)s_%(column_0_N_name)s_%(referred_table_name)s",
    "pk": "pk_%(table_name)s",
}

# Any: JSON documents shaped by the contracts (validated by Pydantic before they are stored).
Json = dict[str, Any]
JsonList = list[Any]


class Base(DeclarativeBase):
    metadata = MetaData(naming_convention=NAMING_CONVENTION)
    type_annotation_map = {
        str: Text(),
        datetime: DateTime(timezone=True),
        date: Date(),
        Decimal: Numeric(12, 4),
        Json: JSONB(),
        JsonList: JSONB(),
        list[str]: ARRAY(Text()),
    }


def created_at_column() -> Mapped[datetime]:
    return mapped_column(server_default=func.now())


def check_in(name: str, column: str, values: tuple[str, ...]) -> CheckConstraint:
    return CheckConstraint(sql_in(column, values), name=name)
