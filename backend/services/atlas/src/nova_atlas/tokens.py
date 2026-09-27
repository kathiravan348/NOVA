"""Kite tokens for downloads: stocks from `instruments`, indices from `market_indices` (D62)."""

from nova_db.models import Instrument, MarketIndex
from sqlalchemy import select
from sqlalchemy.orm import Session


def index_names(db: Session) -> set[str]:
    """Every index an Owner can download (its candles are stored under the index name)."""
    return set(db.scalars(select(MarketIndex.name)))


def kite_tokens(db: Session, exchange: str, symbols: list[str]) -> dict[str, int | None]:
    """Token per known name (None = known but not synced with Kite yet); unknown names are left out.

    A stock symbol wins over an index name; the two never overlap (index names contain spaces).
    """
    tokens: dict[str, int | None] = {
        symbol: token
        for symbol, token in db.execute(
            select(Instrument.symbol, Instrument.instrument_token).where(
                Instrument.exchange == exchange, Instrument.symbol.in_(symbols)
            )
        )
    }
    rest = [s for s in symbols if s not in tokens]
    if rest and exchange == "NSE":
        for name, token in db.execute(
            select(MarketIndex.name, MarketIndex.instrument_token).where(MarketIndex.name.in_(rest))
        ):
            tokens[name] = token
    return tokens
