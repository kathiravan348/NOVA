"""Strategy library (D62 (7)): mirrors `frontend/packages/contracts/src/library.ts`."""

from typing import Annotated, Literal, Self

from pydantic import Field, model_validator

from nova_contracts.backtest import BacktestBenchmark, Universe, _Period
from nova_contracts.common import Contract
from nova_contracts.strategy import StrategySpec

LibraryFamilyId = Literal[
    "momentum_rotation", "trend", "pullback", "pattern", "low_turnover", "baseline", "intraday"
]
LibraryEntryId = Annotated[str, Field(pattern=r"^[A-G][0-9]{2}$")]
NonEmpty = Annotated[str, Field(min_length=1)]


class LibraryFamily(Contract):
    id: LibraryFamilyId
    name: NonEmpty
    idea: NonEmpty
    watch: NonEmpty


class LibraryBacktest(_Period):
    """The suggested first backtest of an entry (the Library's Backtest button)."""

    universe: Universe
    initial_capital_paise: Annotated[int, Field(gt=0)]
    benchmark: BacktestBenchmark | None


class LibraryEntry(Contract):
    id: LibraryEntryId
    family: LibraryFamilyId
    name: NonEmpty
    summary: Annotated[str, Field(min_length=1, max_length=140)]
    spec: StrategySpec
    backtest: LibraryBacktest


class StrategyLibrary(Contract):
    families: list[LibraryFamily]
    entries: list[LibraryEntry]


class LibraryInstall(Contract):
    """Body of `POST /strategies/library/install`: entry ids, each once."""

    ids: Annotated[list[LibraryEntryId], Field(min_length=1, max_length=100)]

    @model_validator(mode="after")
    def _unique(self) -> Self:
        if len(set(self.ids)) != len(self.ids):
            raise ValueError("Each id may appear once")
        return self
