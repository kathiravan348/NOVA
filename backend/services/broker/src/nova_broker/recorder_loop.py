"""The always-on tick recorder (D49, D54): records market hours while Relay's switch is on.

Every `poll_seconds` it reads `recorder_settings`. On a weekday between 09:15 and 15:30 IST,
with the switch on and a live Kite session, it opens a `tick_record` data job and records until
15:30, until the switch goes off or the job is cancelled in Relay (a cancel also turns it off).
"""

import asyncio
import logging
import threading
from collections.abc import Callable
from dataclasses import dataclass, field
from datetime import UTC, datetime, time, timedelta
from decimal import Decimal
from typing import Any
from zoneinfo import ZoneInfo

from nova_common import ApiException
from nova_contracts import MAX_RECORDER_SYMBOLS
from nova_db import new_id
from nova_db.models import DataJob, Instrument, RecorderSetting, Tick
from sqlalchemy import select, update
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session, sessionmaker
from websockets.asyncio.client import connect

from nova_broker.crypto import TokenCipher
from nova_broker.internal import active_session
from nova_broker.recorder import Recorder, Sink, kite_url

logger = logging.getLogger("nova.broker.recorder_loop")

IST = ZoneInfo("Asia/Kolkata")
MARKET_OPEN = time(9, 15)
MARKET_CLOSE = time(15, 30)
CHECK_SECONDS = 5.0
RETRY_AFTER = timedelta(minutes=5)
ERROR_LENGTH = 500

# (url, instrument token → symbol, sink, should_stop): records until should_stop() is true.
Record = Callable[[str, dict[int, str], Sink, Callable[[], bool]], None]


def in_market_hours(now: datetime) -> bool:
    local = now.astimezone(IST)
    return local.weekday() < 5 and MARKET_OPEN <= local.time() < MARKET_CLOSE


def session_progress(now: datetime) -> Decimal:
    """How much of today's 09:15–15:30 session has passed, in percent (0–100)."""
    local = now.astimezone(IST)
    start = datetime.combine(local.date(), MARKET_OPEN, IST)
    end = datetime.combine(local.date(), MARKET_CLOSE, IST)
    share = (local - start) / (end - start)
    return Decimal(str(round(min(max(share, 0.0), 1.0) * 100, 2)))


def tick_symbols(db: Session, symbols: list[str]) -> dict[int, str]:
    """Instrument token → symbol for NSE instruments with a token (all of them when none given)."""
    query = select(Instrument.instrument_token, Instrument.symbol).where(
        Instrument.exchange == "NSE", Instrument.instrument_token.is_not(None)
    )
    if symbols:
        query = query.where(Instrument.symbol.in_(symbols))
    found = {int(token): symbol for token, symbol in db.execute(query).tuples() if token}
    missing = sorted(set(symbols) - set(found.values()))
    if missing:
        raise ValueError(f"Not synced with Kite yet: {', '.join(missing)}")
    if not found:
        raise ValueError("No stock is synced with Kite yet: sync the stock list first")
    if len(found) > MAX_RECORDER_SYMBOLS:
        raise ValueError(f"Kite streams at most {MAX_RECORDER_SYMBOLS} stocks; choose fewer")
    return found


def load_setting(db: Session) -> RecorderSetting:
    """The single settings row (migration 0007 creates it; recreated if someone deleted it)."""
    row = db.get(RecorderSetting, 1)
    if row is None:
        row = RecorderSetting(id=1, enabled=False, symbols=[])
        db.add(row)
        db.flush()
    return row


def running_job(db: Session) -> DataJob | None:
    query = select(DataJob).where(DataJob.type == "tick_record", DataJob.status == "running")
    return db.scalars(query.order_by(DataJob.created_at.desc()).limit(1)).first()


def record_with_kite(
    url: str, tokens: dict[int, str], sink: Sink, should_stop: Callable[[], bool]
) -> None:
    recorder = Recorder(
        url=url, symbols=tokens, sink=sink, connect=connect, should_stop=should_stop
    )
    asyncio.run(recorder.run())


@dataclass
class RecorderLoop:
    """`cipher` is None without `NOVA_BROKER_TOKEN_KEY`: the loop then only idles.

    The API key comes from the logged-in account's own Kite app (D55).
    """

    factory: sessionmaker[Session]
    cipher: TokenCipher | None
    stop: threading.Event
    record: Record = record_with_kite
    now: Callable[[], datetime] = field(default=lambda: datetime.now(UTC))
    poll_seconds: float = 30.0
    retry_at: datetime | None = None

    def run(self) -> None:
        self.recover()
        while not self.stop.is_set():
            self.step()
            self.stop.wait(self.poll_seconds)

    def recover(self) -> None:
        """Fails recordings a stopped recorder left `running`; the next step starts a new one."""
        with self.factory() as db:
            for job in db.scalars(
                select(DataJob).where(DataJob.type == "tick_record", DataJob.status == "running")
            ):
                self._end(job, "Recorder stopped before the session ended; it resumes on restart")
            db.commit()

    def step(self) -> str | None:
        """Starts and runs one recording when it should; returns its job id, or None."""
        now = self.now()
        if self.cipher is None:
            return None
        if self.retry_at is not None and now < self.retry_at:
            return None
        with self.factory() as db:
            setting = load_setting(db)
            db.commit()
            if not setting.enabled or not in_market_hours(now):
                return None
            try:
                live = active_session(db, self.cipher)
                tokens = tick_symbols(db, list(setting.symbols))
            except (ApiException, ValueError) as exc:
                logger.info("Not recording: %s", exc)
                return None
            job = DataJob(
                id=new_id("job"),
                type="tick_record",
                status="running",
                exchange="NSE",
                segment="equity_delivery",
                symbols=sorted(tokens.values()),
                timeframe=None,
                progress_percent=session_progress(now),
                started_at=now,
            )
            db.add(job)
            db.commit()
            job_id = job.id
        logger.info("Recording %s symbol(s) as %s", len(tokens), job_id)
        self._record(job_id, kite_url(live.api_key, live.access_token), tokens)
        return job_id

    def _record(self, job_id: str, url: str, tokens: dict[int, str]) -> None:
        last_check = self.now()
        wanted = True

        # Any: rows are `ticks` column values for a bulk insert.
        def sink(rows: list[dict[str, Any]]) -> None:
            with self.factory() as db:
                db.execute(insert(Tick).on_conflict_do_nothing(), rows)
                db.execute(
                    update(DataJob)
                    .where(DataJob.id == job_id)
                    .values(rows_written=DataJob.rows_written + len(rows))
                )
                db.commit()

        def should_stop() -> bool:
            nonlocal last_check, wanted
            now = self.now()
            if self.stop.is_set() or not in_market_hours(now):
                return True
            if (now - last_check).total_seconds() >= CHECK_SECONDS:
                last_check = now
                wanted = self._still_wanted(job_id, now)
            return not wanted

        error: str | None = None
        try:
            self.record(url, tokens, sink, should_stop)
        except Exception as exc:  # any failure ends this job only; the loop retries later
            logger.exception("Recording %s failed", job_id)
            error = str(exc) or type(exc).__name__
        if error is None and self.stop.is_set():
            error = "Recorder stopped before the session ended; it resumes on restart"
        self._finish(job_id, error)

    def _still_wanted(self, job_id: str, now: datetime) -> bool:
        """Also moves the job's progress along the trading session."""
        with self.factory() as db:
            job = db.get(DataJob, job_id)
            enabled = load_setting(db).enabled
            if job is None or job.status != "running":
                return False
            job.progress_percent = session_progress(now)
            db.commit()
            return enabled

    def _finish(self, job_id: str, error: str | None) -> None:
        with self.factory() as db:
            job = db.get(DataJob, job_id)
            if job is None:
                return
            if job.status == "cancelled":
                # Cancelling the recording in Relay means "stop recording": switch it off too.
                setting = load_setting(db)
                setting.enabled = False
                setting.updated_at = self.now()
                job.finished_at = self.now()
            else:
                self._end(job, error)
            db.commit()
        if error is not None:
            self.retry_at = self.now() + RETRY_AFTER

    def _end(self, job: DataJob, error: str | None) -> None:
        job.status = "failed" if error else "completed"
        job.error = error[:ERROR_LENGTH] if error else None
        if not error:
            job.progress_percent = Decimal(100)
        job.finished_at = self.now()
