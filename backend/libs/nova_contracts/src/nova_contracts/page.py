"""Page envelope for growing lists (D32): mirrors `pageSchema` in `common.ts`."""

from typing import Annotated

from pydantic import Field

from nova_contracts.common import Contract

PAGE_LIMIT_DEFAULT = 50
PAGE_LIMIT_MAX = 200


class Page[T](Contract):
    items: list[T]
    next_cursor: Annotated[str, Field(min_length=1)] | None
