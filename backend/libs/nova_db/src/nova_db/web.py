"""FastAPI glue: one database session per request from `app.state.session_factory`."""

from collections.abc import Iterator
from typing import Annotated

from fastapi import Depends, Request
from sqlalchemy.orm import Session, sessionmaker


def get_db(request: Request) -> Iterator[Session]:
    """Routes commit explicitly; anything uncommitted is rolled back when the session closes."""
    factory: sessionmaker[Session] = request.app.state.session_factory
    with factory() as db:
        yield db


Db = Annotated[Session, Depends(get_db)]
