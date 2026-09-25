"""Historical download jobs (D11, D41): Kite candles → `candles`, in Kite-sized chunks."""

from dataclasses import dataclass
from datetime import UTC, date, datetime, time, timedelta
from decimal import ROUND_HALF_UP, Decimal
from typing import Any
from zoneinfo import ZoneInfo

from nova_db.models import Candle, DataJob, Instrument
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from nova_atlas.broker_client import BrokerData, BrokerDataError

IST = ZoneInfo("Asia/Kolkata")
KITE_INTERVAL = {
    "1m": "minute",
    "3m": "3minute",
    "5m": "5minute",
    "15m": "15minute",
    "30m": "30minute",
    "1h": "60minute",
    "1d": "day",
}
# Most days Kite returns per historical request, by timeframe.
CHUNK_DAYS = {"1m": 60, "3m": 100, "5m": 100, "15m": 200, "30m": 200, "1h": 400, "1d": 2000}
ERROR_LENGTH = 300


@dataclass(frozen=True)
class Chunk:
    start: datetime
    end: datetime


def plan_chunks(first: date, last: date, timeframe: str) -> list[Chunk]:
    """Day ranges Kite accepts in one call, covering `first`..`last` (IST calendar days)."""
    size = timedelta(days=CHUNK_DAYS[timeframe])
    chunks: list[Chunk] = []
    day = first
    while day <= last:
        end_day = min(day + size - timedelta(days=1), last)
        chunks.append(
            Chunk(
                start=datetime.combine(day, time(0, 0), tzinfo=IST),
                end=datetime.combine(end_day, time(23, 59, 59), tzinfo=IST),
            )
        )
        day = end_day + timedelta(days=1)
    return chunks


def to_paise(rupees: float | int | str) -> int:
    """Kite prices are rupees as JSON numbers; `str` first so 1500.35 stays exact (D17)."""
    return int((Decimal(str(rupees)) * 100).quantize(Decimal(1), rounding=ROUND_HALF_UP))


def to_row(exchange: str, symbol: str, timeframe: str, bar: list[Any]) -> dict[str, Any] | None:
    """A `candles` row, or None for a bar that breaks the OHLC rules (Kite sends a few).

    Any: Kite rows mix text and numbers.
    """
    stamp, open_raw, high_raw, low_raw, close_raw, volume_raw = bar[:6]
    open_, high, low = to_paise(open_raw), to_paise(high_raw), to_paise(low_raw)
    close, volume = to_paise(close_raw), int(volume_raw)
    valid = (
        open_ > 0
        and low > 0
        and volume >= 0
        and high >= max(open_, close)
        and low <= min(open_, close)
    )
    if not valid:
        return None
    return {
        "exchange": exchange,
        "symbol": symbol,
        "timeframe": timeframe,
        "ts": datetime.fromisoformat(str(stamp)).astimezone(UTC),
        "open_paise": open_,
        "high_paise": high,
        "low_paise": low,
        "close_paise": close,
        "volume": volume,
    }


def upsert_candles(db: Session, rows: list[dict[str, Any]]) -> int:
    """Any: rows built by `to_row`."""
    if not rows:
        return 0
    statement = insert(Candle).values(rows)
    prices = ("open_paise", "high_paise", "low_paise", "close_paise", "volume")
    statement = statement.on_conflict_do_update(
        index_elements=["exchange", "symbol", "timeframe", "ts"],
        set_={name: statement.excluded[name] for name in prices},
    )
    db.execute(statement)
    return len(rows)


def finish_job(db: Session, job: DataJob, error: str | None) -> None:
    """Ends a job `completed` (100%) or `failed` with `error`, and commits."""
    job.status = "failed" if error else "completed"
    job.error = error[:ERROR_LENGTH] if error else None
    if not error:
        job.progress_percent = Decimal(100)
    job.finished_at = datetime.now(UTC)
    db.commit()


def fail_job(db: Session, job_id: str, message: str) -> None:
    job = db.get(DataJob, job_id)
    if job is not None:
        finish_job(db, job, message)


def run_download(db: Session, job_id: str, broker: BrokerData) -> None:
    """Runs one claimed `historical_download` job to `completed`, `failed` or `cancelled`."""
    job = db.get(DataJob, job_id)
    if job is None or job.timeframe is None or job.date_from is None or job.date_to is None:
        raise ValueError(f"Job {job_id} is not a runnable historical download")
    found = db.execute(
        select(Instrument.symbol, Instrument.instrument_token).where(
            Instrument.exchange == job.exchange, Instrument.symbol.in_(job.symbols)
        )
    )
    tokens = {symbol: token for symbol, token in found}
    missing = [s for s in job.symbols if tokens.get(s) is None]
    if missing:
        finish_job(
            db,
            job,
            f"Unknown instruments: {', '.join(missing)} (sync the stock list with Kite first)",
        )
        return

    chunks = plan_chunks(job.date_from, job.date_to, job.timeframe)
    total, done = len(chunks) * len(job.symbols), 0
    try:
        for symbol in job.symbols:
            token = tokens[symbol]
            assert token is not None
            for chunk in chunks:
                db.refresh(job)
                if job.status == "cancelled":
                    job.finished_at = datetime.now(UTC)
                    db.commit()
                    return
                bars = broker.historical(
                    token, KITE_INTERVAL[job.timeframe], chunk.start, chunk.end
                )
                rows = [
                    r for bar in bars if (r := to_row(job.exchange, symbol, job.timeframe, bar))
                ]
                job.rows_written += upsert_candles(db, rows)
                done += 1
                job.progress_percent = Decimal(done * 100) / Decimal(total)
                db.commit()
    except (BrokerDataError, ValueError, TypeError) as exc:
        db.rollback()
        finish_job(db, job, str(exc) or type(exc).__name__)
        return
    finish_job(db, job, None)
