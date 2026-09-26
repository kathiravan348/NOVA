"""Historical download jobs (D11, D41): Kite candles → `candles`, in Kite-sized chunks."""

import time as time_module
from collections.abc import Callable
from dataclasses import dataclass
from datetime import UTC, date, datetime, time, timedelta
from decimal import ROUND_HALF_UP, Decimal
from typing import Any
from zoneinfo import ZoneInfo

from nova_contracts import MarketHoursMode
from nova_db.models import Candle, DataJob, DataJobStep, DownloadSetting, Instrument
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
# Rows per INSERT: Postgres takes at most 65,535 values per statement (8 columns → 40,000).
CANDLE_BATCH = 5000
MARKET_OPEN, MARKET_CLOSE = time(9, 15), time(15, 30)


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
    prices = ("open_paise", "high_paise", "low_paise", "close_paise", "volume")
    for first in range(0, len(rows), CANDLE_BATCH):
        statement = insert(Candle).values(rows[first : first + CANDLE_BATCH])
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


def is_market_hours(at: datetime) -> bool:
    ist = at.astimezone(IST)
    return ist.weekday() < 5 and MARKET_OPEN <= ist.time() < MARKET_CLOSE


def request_gap(at: datetime, pace_mode: str) -> float:
    """Seconds between historical requests: 1 in slow market hours, else the account's 2/s."""
    return 1.0 if pace_mode == "slow" and is_market_hours(at) else 0.5


def market_hours_mode(db: Session) -> MarketHoursMode:
    row = db.get(DownloadSetting, 1)
    return "full" if row is not None and row.market_hours_mode == "full" else "slow"


class Pacer:
    """Keeps historical requests at most 1/s in market hours when the setting is `slow` (D57 (5)).

    Full pace is left to the broker's rate limiter (2/s, D40).
    """

    def __init__(
        self,
        clock: Callable[[], float] = time_module.monotonic,
        sleep: Callable[[float], None] = time_module.sleep,
        now: Callable[[], datetime] = lambda: datetime.now(UTC),
    ) -> None:
        self._clock, self._sleep, self._now = clock, sleep, now
        self._last: float | None = None

    def wait(self, pace_mode: str) -> None:
        if pace_mode == "slow" and is_market_hours(self._now()) and self._last is not None:
            left = self._last + 1.0 - self._clock()
            if left > 0:
                self._sleep(left)
        self._last = self._clock()


def add_all_steps(db: Session, job: DataJob) -> None:
    """Steps for a download queued before plans existed: every chunk, none skipped."""
    assert job.timeframe is not None and job.date_from is not None and job.date_to is not None
    chunks = plan_chunks(job.date_from, job.date_to, job.timeframe)
    seq = 0
    for symbol in job.symbols:
        for chunk in chunks:
            db.add(
                DataJobStep(
                    job_id=job.id, seq=seq, symbol=symbol, start_at=chunk.start, end_at=chunk.end
                )
            )
            seq += 1
    job.steps_total, job.steps_done = seq, 0
    db.commit()


def _next_step(db: Session, job_id: str) -> DataJobStep | None:
    return db.scalars(
        select(DataJobStep)
        .where(DataJobStep.job_id == job_id, DataJobStep.status == "pending")
        .order_by(DataJobStep.seq)
        .limit(1)
    ).first()


def run_download(db: Session, job_id: str, broker: BrokerData, pacer: Pacer | None = None) -> None:
    """Runs the pending steps of a claimed download, saving each as it finishes (D57 (4)).

    Ends `completed`, `failed` or `cancelled`; returns early, still `paused`, when paused.
    """
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
            f"Not synced with Kite: {', '.join(missing)}. Run Sync with Kite on Instruments first.",
        )
        return
    if job.steps_total == 0:
        add_all_steps(db, job)
    pacer = pacer or Pacer()
    try:
        while True:
            db.refresh(job)
            if job.status == "cancelled":
                job.finished_at = datetime.now(UTC)
                db.commit()
                return
            if job.status == "paused":
                return
            step = _next_step(db, job.id)
            if step is None:
                break
            token = tokens[step.symbol]
            assert token is not None
            pacer.wait(market_hours_mode(db))
            bars = broker.historical(
                token,
                KITE_INTERVAL[job.timeframe],
                step.start_at.astimezone(IST),
                step.end_at.astimezone(IST),
            )
            rows = [
                r for bar in bars if (r := to_row(job.exchange, step.symbol, job.timeframe, bar))
            ]
            written = upsert_candles(db, rows)
            step.status, step.rows_written = "done", written
            step.finished_at = datetime.now(UTC)
            job.rows_written += written
            job.steps_done += 1
            job.progress_percent = Decimal(job.steps_done * 100) / Decimal(job.steps_total)
            db.commit()
    except (BrokerDataError, ValueError, TypeError) as exc:
        db.rollback()
        finish_job(db, job, str(exc) or type(exc).__name__)
        return
    finish_job(db, job, None)
