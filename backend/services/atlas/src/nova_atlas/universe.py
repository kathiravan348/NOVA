"""Stock list (D41, D54, D56): every NSE stock on Kite, NSE index members, tokens, lot sizes."""

import csv
import io
import re
from collections.abc import Callable
from dataclasses import dataclass, field
from datetime import UTC, date, datetime

from nova_db.models import Instrument, MarketIndex, UniverseEntry
from sqlalchemy import select
from sqlalchemy.orm import Session

from nova_atlas.broker_client import BrokerData, BrokerDataError

EXCHANGE = "NSE"
UNCLASSIFIED = "Unclassified"
# Kite's NSE equity rows: plain symbols (main board, ETFs) and the trade-for-trade / SME series.
# Other suffixes are bonds, SGBs, T-bills and the like (D56).
STOCK_SYMBOL = re.compile(r"^[A-Z0-9&]+(-(BE|BZ|SM|ST))?$")
NAME_LENGTH = 80

# Reports how far the sync got: (share done 0-1, what it is doing).
Progress = Callable[[float, str], None]


@dataclass(frozen=True)
class KiteStock:
    symbol: str
    name: str
    token: int


@dataclass
class SyncResult:
    synced: list[str] = field(default_factory=list)
    missing: list[str] = field(default_factory=list)
    added: list[str] = field(default_factory=list)
    new_listings: list[str] = field(default_factory=list)
    failed_indices: list[str] = field(default_factory=list)

    def summary(self) -> str:
        """One line for the job page (≤ 500 chars)."""
        parts = [f"{len(self.synced):,} stocks synced"]
        if self.added:
            parts.append(f"{len(self.added):,} added")
        if self.new_listings:
            shown = ", ".join(self.new_listings[:10])
            more = f" and {len(self.new_listings) - 10} more" if len(self.new_listings) > 10 else ""
            parts.append(f"{len(self.new_listings)} new listing(s): {shown}{more}")
        if self.missing:
            parts.append(f"{len(self.missing)} not on Kite: {', '.join(self.missing[:10])}")
        if self.failed_indices:
            parts.append(f"NSE file failed: {', '.join(self.failed_indices)}")
        return "; ".join(parts)[:500]


def load_universe(db: Session) -> list[UniverseEntry]:
    """Every stock of the list, by symbol."""
    query = select(UniverseEntry).where(UniverseEntry.exchange == EXCHANGE)
    return list(db.scalars(query.order_by(UniverseEntry.symbol)))


def kite_stocks(nse_csv: str) -> tuple[dict[str, KiteStock], dict[str, int]]:
    """NSE stocks by symbol, and index tokens by Kite trading symbol."""
    stocks: dict[str, KiteStock] = {}
    indices: dict[str, int] = {}
    for row in csv.DictReader(io.StringIO(nse_csv)):
        symbol, token = row["tradingsymbol"], int(row["instrument_token"])
        if row["segment"] == "INDICES":
            indices[symbol] = token
        elif (
            row["segment"] == "NSE"
            and row["instrument_type"] == "EQ"
            and STOCK_SYMBOL.match(symbol)
            and len(symbol) <= 20
        ):
            name = row["name"].strip() or symbol
            stocks[symbol] = KiteStock(symbol, name[:NAME_LENGTH], token)
    return stocks, indices


def _lot_sizes(nfo_csv: str, today: date) -> dict[str, int]:
    """Lot size of each underlying's nearest live future."""
    nearest: dict[str, tuple[date, int]] = {}
    for row in csv.DictReader(io.StringIO(nfo_csv)):
        if row["segment"] != "NFO-FUT" or not row["expiry"]:
            continue
        expiry = date.fromisoformat(row["expiry"])
        if expiry < today:
            continue
        current = nearest.get(row["name"])
        if current is None or expiry < current[0]:
            nearest[row["name"]] = (expiry, int(row["lot_size"]))
    return {name: lot for name, (_, lot) in nearest.items()}


@dataclass
class _Members:
    """What the NSE files say: index → symbols, and each symbol's company name and industry."""

    by_index: dict[str, set[str]] = field(default_factory=dict)
    company: dict[str, str] = field(default_factory=dict)
    industry: dict[str, str] = field(default_factory=dict)


def _fetch_members(
    db: Session, broker: BrokerData, tokens: dict[str, int], result: SyncResult, progress: Progress
) -> _Members:
    members = _Members()
    indices = list(db.scalars(select(MarketIndex).order_by(MarketIndex.member_count.desc())))
    for n, index in enumerate(indices):
        progress(0.1 + 0.8 * n / max(len(indices), 1), f"Reading {index.name}")
        index.instrument_token = tokens.get(index.kite_symbol, index.instrument_token)
        try:
            rows = broker.constituents(index.constituents_file)
        except BrokerDataError:
            result.failed_indices.append(index.name)
            continue
        members.by_index[index.name] = {row.symbol for row in rows}
        for row in rows:
            members.company.setdefault(row.symbol, row.company[:NAME_LENGTH])
            if row.industry:
                members.industry.setdefault(row.symbol, row.industry[:NAME_LENGTH])
        index.member_count = len(rows)
        index.updated_at = datetime.now(UTC)
    return members


def sync_instruments(
    db: Session,
    broker: BrokerData,
    today: date | None = None,
    *,
    mark_new: bool = False,
    progress: Progress | None = None,
) -> SyncResult:
    """Adds every NSE stock Kite lists, refreshes index members and sectors, then tokens (D56).

    `mark_new`: flag stocks added now as new listings (an earlier sync has completed).
    Hand-added stocks stay; stocks Kite no longer lists are reported as missing, never deleted.
    """
    report = progress or (lambda _share, _step: None)
    stocks, index_tokens = kite_stocks(broker.instruments(EXCHANGE))
    lots = _lot_sizes(broker.instruments("NFO"), today or datetime.now(UTC).date())
    report(0.1, "Read Kite's instrument lists")
    result = SyncResult()
    members = _fetch_members(db, broker, index_tokens, result, report)
    fetched = members.by_index
    known_indices = set(db.scalars(select(MarketIndex.name)))

    now = datetime.now(UTC)
    universe = {row.symbol: row for row in load_universe(db)}
    for symbol, kite in stocks.items():
        if symbol not in universe:
            row = UniverseEntry(
                exchange=EXCHANGE,
                symbol=symbol,
                name=members.company.get(symbol, kite.name),
                sector=UNCLASSIFIED,
                indices=[],
                new_listing=mark_new,
            )
            db.add(row)
            universe[symbol] = row
            result.added.append(symbol)
            if mark_new:
                result.new_listings.append(symbol)

    instruments = {
        i.symbol: i for i in db.scalars(select(Instrument).where(Instrument.exchange == EXCHANGE))
    }
    for symbol in sorted(universe):
        row = universe[symbol]
        # Keep membership of indices whose file failed; replace the rest with what NSE says.
        kept = [i for i in row.indices if i in known_indices and i not in fetched]
        now_in = [name for name, symbols in fetched.items() if symbol in symbols]
        indices = sorted(set(kept) | set(now_in))
        sector = row.sector
        if sector == UNCLASSIFIED and symbol in members.industry:
            sector = members.industry[symbol]
        if row.indices != indices or row.sector != sector:
            row.indices, row.sector, row.updated_at = indices, sector, now
        stock = stocks.get(symbol)
        if stock is None:
            result.missing.append(symbol)
            continue
        instrument = instruments.get(symbol) or Instrument(exchange=EXCHANGE, symbol=symbol)
        instrument.name = row.name
        instrument.segment = "equity_delivery"
        instrument.sector = row.sector
        instrument.indices = list(row.indices)
        instrument.lot_size = lots.get(symbol)
        instrument.instrument_token = stock.token
        instrument.updated_at = now
        db.add(instrument)
        result.synced.append(symbol)
    report(0.95, "Saved the stock list")
    db.commit()
    return result
