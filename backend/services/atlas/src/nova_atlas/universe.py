"""Stock list (D41, D54): the `universe` table (edited in Relay) + Kite tokens and lot sizes."""

import csv
import io
from dataclasses import dataclass
from datetime import UTC, date, datetime

from nova_db.models import Instrument, UniverseEntry
from sqlalchemy import select
from sqlalchemy.orm import Session

from nova_atlas.broker_client import BrokerData

EXCHANGE = "NSE"


@dataclass(frozen=True)
class SyncResult:
    synced: list[str]
    missing: list[str]


def load_universe(db: Session) -> list[UniverseEntry]:
    """Every stock of the list, by symbol."""
    query = select(UniverseEntry).where(UniverseEntry.exchange == EXCHANGE)
    return list(db.scalars(query.order_by(UniverseEntry.symbol)))


def _equity_tokens(nse_csv: str) -> dict[str, int]:
    return {
        row["tradingsymbol"]: int(row["instrument_token"])
        for row in csv.DictReader(io.StringIO(nse_csv))
        if row["segment"] == "NSE" and row["instrument_type"] == "EQ"
    }


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


def sync_instruments(db: Session, broker: BrokerData, today: date | None = None) -> SyncResult:
    """Upserts every listed stock that Kite has on NSE; reports the ones it does not."""
    universe = load_universe(db)
    tokens = _equity_tokens(broker.instruments(EXCHANGE))
    lots = _lot_sizes(broker.instruments("NFO"), today or datetime.now(UTC).date())
    synced, missing = [], []
    for row in universe:
        token = tokens.get(row.symbol)
        if token is None:
            missing.append(row.symbol)
            continue
        instrument = db.get(Instrument, (EXCHANGE, row.symbol)) or Instrument(
            exchange=EXCHANGE, symbol=row.symbol
        )
        instrument.name = row.name
        instrument.segment = "equity_delivery"
        instrument.sector = row.sector
        instrument.indices = list(row.indices)
        instrument.lot_size = lots.get(row.symbol)
        instrument.instrument_token = token
        instrument.updated_at = datetime.now(UTC)
        db.add(instrument)
        synced.append(row.symbol)
    db.commit()
    return SyncResult(synced=synced, missing=missing)
