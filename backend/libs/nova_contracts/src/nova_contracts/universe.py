"""Stock list (D54): mirrors `frontend/packages/contracts/src/universe.ts`."""

from typing import Annotated

from pydantic import Field

from nova_contracts.common import Contract
from nova_contracts.market_data import IndexName

Symbol = Annotated[str, Field(pattern=r"^[A-Z0-9&-]{1,20}$")]
Text80 = Annotated[str, Field(max_length=80, pattern=r"\S")]


class UniverseEntryWrite(Contract):
    """Body of `POST /market-data/universe` and `PUT /market-data/universe/{symbol}`."""

    symbol: Symbol
    name: Text80
    sector: Text80
    indices: list[IndexName]


class UniverseEntry(UniverseEntryWrite):
    """`synced`: Kite knows the symbol (its instrument has a token), so it can be downloaded."""

    synced: bool


class InstrumentSyncResult(Contract):
    synced: list[Symbol]
    missing: list[Symbol]
