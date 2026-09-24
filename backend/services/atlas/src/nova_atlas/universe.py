"""Instrument universe (D41): `data/universe.csv` (Owner-edited) + Kite tokens and lot sizes."""

import csv
import io
from dataclasses import dataclass
from datetime import UTC, date, datetime
from importlib import resources

from nova_db.enums import INDEX_NAMES
from nova_db.models import Instrument
from sqlalchemy.orm import Session

from nova_atlas.broker_client import BrokerData


@dataclass(frozen=True)
class UniverseRow:
    symbol: str
    name: str
    sector: str
    indices: list[str]


@dataclass(frozen=True)
class SyncResult:
    synced: list[str]
    missing: list[str]


def load_universe(text: str | None = None) -> list[UniverseRow]:
    """Reads the universe file (or `text`); rejects unknown index names and duplicate symbols."""
    if text is None:
        text = resources.files("nova_atlas").joinpath("data/universe.csv").read_text("utf-8")
    rows: list[UniverseRow] = []
    for record in csv.DictReader(io.StringIO(text)):
        indices = [name for name in record["indices"].split("|") if name]
        unknown = [name for name in indices if name not in INDEX_NAMES]
        if unknown:
            raise ValueError(f"{record['symbol']}: unknown index {unknown[0]}")
        rows.append(UniverseRow(record["symbol"], record["name"], record["sector"], indices))
    symbols = [row.symbol for row in rows]
    if len(set(symbols)) != len(symbols):
        raise ValueError("universe.csv lists a symbol twice")
    return rows


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
    """Upserts every universe symbol that Kite lists on NSE; reports the ones it does not."""
    universe = load_universe()
    tokens = _equity_tokens(broker.instruments("NSE"))
    lots = _lot_sizes(broker.instruments("NFO"), today or datetime.now(UTC).date())
    synced, missing = [], []
    for row in universe:
        token = tokens.get(row.symbol)
        if token is None:
            missing.append(row.symbol)
            continue
        instrument = db.get(Instrument, ("NSE", row.symbol)) or Instrument(
            exchange="NSE", symbol=row.symbol
        )
        instrument.name = row.name
        instrument.segment = "equity_delivery"
        instrument.sector = row.sector
        instrument.indices = row.indices
        instrument.lot_size = lots.get(row.symbol)
        instrument.instrument_token = token
        instrument.updated_at = datetime.now(UTC)
        db.add(instrument)
        synced.append(row.symbol)
    db.commit()
    return SyncResult(synced=synced, missing=missing)
