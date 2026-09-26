"""Download plans (D57): steps, what is already stored, cost and time, before anything runs."""

import math
from dataclasses import dataclass
from datetime import UTC, date, datetime, time, timedelta
from decimal import Decimal

from nova_contracts import MAX_DOWNLOAD_SYMBOLS, DataJobPlan, DataJobPlanSymbol
from nova_db import new_id
from nova_db.audit import record_audit
from nova_db.enums import DOWNLOAD_MODES, DOWNLOAD_TIMEFRAMES, SEGMENTS
from nova_db.models import DataJob, DataJobStep, Instrument
from sqlalchemy import select, text
from sqlalchemy.orm import Session

from nova_atlas.download import (
    IST,
    Chunk,
    market_hours_mode,
    plan_chunks,
    request_gap,
)
from nova_atlas.universe import load_universe

# Bars in one NSE session (09:15-15:30, 375 minutes) by timeframe.
BARS_PER_DAY = {"1m": 375, "3m": 125, "5m": 75, "15m": 25, "30m": 13, "1h": 7, "1d": 1}
ROW_BYTES = 80
# A step counts as stored when candles start and end within this many days of it, no longer gap.
GAP_DAYS = 5
MARGIN = 1.2
DRAFT_HOURS = 24
WARN_ROWS = 20_000_000
WARN_SECONDS = 2 * 3600
KITE_INTRADAY_FROM = date(2015, 1, 1)
WORKER_TYPES = ("historical_download", "archive", "instrument_sync")


@dataclass(frozen=True)
class PlannedStep:
    symbol: str
    chunk: Chunk
    skipped: bool


def estimate_seconds(requests: int, start: datetime, pace_mode: str) -> int:
    at, total = start, 0.0
    for _ in range(requests):
        gap = request_gap(at, pace_mode)
        total += gap
        at += timedelta(seconds=gap)
    return math.ceil(total * MARGIN)


def weekdays(first: date, last: date) -> int:
    days = (last - first).days + 1
    full_weeks, rest = divmod(max(days, 0), 7)
    count = full_weeks * 5
    for offset in range(rest):
        if (first + timedelta(days=full_weeks * 7 + offset)).weekday() < 5:
            count += 1
    return count


def stored_dates(
    db: Session, exchange: str, symbol: str, timeframe: str, first: date, last: date
) -> list[date]:
    """IST calendar days that have at least one candle, oldest first."""
    start = datetime.combine(first, time(0, 0), tzinfo=IST)
    end = datetime.combine(last + timedelta(days=1), time(0, 0), tzinfo=IST)
    rows = db.execute(
        text(
            "SELECT DISTINCT (ts AT TIME ZONE 'Asia/Kolkata')::date AS day FROM candles"
            " WHERE exchange = :exchange AND symbol = :symbol AND timeframe = :timeframe"
            " AND ts >= :start AND ts < :end ORDER BY day"
        ),
        {
            "exchange": exchange,
            "symbol": symbol,
            "timeframe": timeframe,
            "start": start,
            "end": end,
        },
    )
    return list(rows.scalars())


def is_covered(days: list[date], first: date, last: date) -> bool:
    """Stored candles span `first`..`last` give or take `GAP_DAYS`, with no longer hole."""
    inside = [d for d in days if first <= d <= last]
    if not inside:
        return False
    gap = timedelta(days=GAP_DAYS)
    if inside[0] - first > gap or last - inside[-1] > gap:
        return False
    return all(b - a <= gap for a, b in zip(inside, inside[1:], strict=False))


def check_request(
    db: Session, symbols: list[str], timeframe: str, first: date, last: date, segment: str
) -> list[str]:
    """Clean symbols, or ValueError with the reason (the API answers 400)."""
    symbols = list(dict.fromkeys(s.strip().upper() for s in symbols if s.strip()))
    if not symbols or len(symbols) > MAX_DOWNLOAD_SYMBOLS:
        raise ValueError(f"Give 1-{MAX_DOWNLOAD_SYMBOLS} symbols")
    known = {row.symbol for row in load_universe(db)}
    unknown = [s for s in symbols if s not in known]
    if unknown:
        raise ValueError(f"Not in the stock list: {', '.join(unknown)}")
    if timeframe not in DOWNLOAD_TIMEFRAMES:
        raise ValueError("Download 1m or 1d; 3m to 1h are built from 1m")
    if first > last:
        raise ValueError("From must be on or before To")
    if segment not in SEGMENTS:
        raise ValueError(f"Segment must be one of {', '.join(SEGMENTS)}")
    return symbols


def _seconds_ahead(db: Session) -> tuple[int, int]:
    """Jobs the worker runs before a new one, and their remaining estimated seconds."""
    jobs = db.scalars(
        select(DataJob).where(
            DataJob.type.in_(WORKER_TYPES), DataJob.status.in_(("queued", "running"))
        )
    ).all()
    seconds = 0.0
    for job in jobs:
        estimate = (job.plan or {}).get("estimatedSeconds")
        if isinstance(estimate, int) and job.steps_total > 0:
            seconds += estimate * (1 - job.steps_done / job.steps_total)
    return len(jobs), math.ceil(seconds)


def build_plan(
    db: Session,
    *,
    symbols: list[str],
    timeframe: str,
    first: date,
    last: date,
    mode: str,
    now: datetime,
    exchange: str = "NSE",
) -> tuple[DataJobPlan, list[PlannedStep]]:
    """Steps in run order (stock by stock, oldest chunk first) and the plan shown before Start."""
    chunks = plan_chunks(first, last, timeframe)
    synced = set(
        db.scalars(
            select(Instrument.symbol).where(
                Instrument.exchange == exchange,
                Instrument.symbol.in_(symbols),
                Instrument.instrument_token.is_not(None),
            )
        )
    )
    steps: list[PlannedStep] = []
    per_symbol: list[DataJobPlanSymbol] = []
    rows = 0
    for symbol in symbols:
        days = stored_dates(db, exchange, symbol, timeframe, first, last)
        skipped = 0
        for chunk in chunks:
            chunk_first, chunk_last = chunk.start.date(), chunk.end.date()
            covered = mode == "skip_existing" and is_covered(days, chunk_first, chunk_last)
            steps.append(PlannedStep(symbol, chunk, covered))
            if covered:
                skipped += 1
            else:
                rows += weekdays(chunk_first, chunk_last) * BARS_PER_DAY[timeframe]
        per_symbol.append(
            DataJobPlanSymbol(
                symbol=symbol,
                steps=len(chunks),
                skipped_steps=skipped,
                existing_from=days[0] if days else None,
                existing_to=days[-1] if days else None,
            )
        )
    requests = sum(1 for step in steps if not step.skipped)
    jobs_ahead, seconds_ahead = _seconds_ahead(db)
    start_at = now + timedelta(seconds=seconds_ahead)
    seconds = estimate_seconds(requests, start_at, market_hours_mode(db))
    warnings = []
    if rows > WARN_ROWS:
        warnings.append(f"About {rows:,} rows: this uses a lot of disk space.")
    if seconds > WARN_SECONDS:
        warnings.append(f"About {seconds // 3600} h {seconds % 3600 // 60} min to finish.")
    not_synced = [s for s in symbols if s not in synced]
    if not_synced:
        warnings.append(f"Not synced with Kite: {', '.join(not_synced)}. Run Sync with Kite first.")
    if timeframe != "1d" and first < KITE_INTRADAY_FROM:
        warnings.append("Kite has intraday history from 2015 only; earlier days come back empty.")
    plan = DataJobPlan(
        steps=len(steps),
        skipped_steps=len(steps) - requests,
        requests=requests,
        estimated_rows=rows,
        estimated_bytes=rows * ROW_BYTES,
        estimated_seconds=seconds,
        estimated_start_at=start_at,
        jobs_ahead=jobs_ahead,
        per_symbol=per_symbol,
        warnings=warnings,
    )
    return plan, steps


def create_download(
    db: Session,
    *,
    symbols: list[str],
    timeframe: str,
    first: date,
    last: date,
    segment: str,
    mode: str,
    start: bool,
    actor_id: str | None,
    actor_name: str,
    ip: str | None,
    now: datetime | None = None,
) -> DataJob:
    """Plans a download with its steps: a `draft` (expires in 24 h) or, with `start`, `queued`."""
    if mode not in DOWNLOAD_MODES:
        raise ValueError(f"Mode must be one of {', '.join(DOWNLOAD_MODES)}")
    symbols = check_request(db, symbols, timeframe, first, last, segment)
    now = now or datetime.now(UTC)
    plan, steps = build_plan(
        db, symbols=symbols, timeframe=timeframe, first=first, last=last, mode=mode, now=now
    )
    skipped = plan.skipped_steps
    job = DataJob(
        id=new_id("job"),
        type="historical_download",
        status="queued" if start else "draft",
        exchange="NSE",
        segment=segment,
        symbols=symbols,
        timeframe=timeframe,
        date_from=first,
        date_to=last,
        mode=mode,
        plan=plan.model_dump(mode="json"),
        expires_at=None if start else now + timedelta(hours=DRAFT_HOURS),
        steps_total=len(steps),
        steps_done=skipped,
        progress_percent=_percent(skipped, len(steps)),
    )
    db.add(job)
    db.flush()
    db.add_all(
        DataJobStep(
            job_id=job.id,
            seq=seq,
            symbol=step.symbol,
            start_at=step.chunk.start,
            end_at=step.chunk.end,
            status="skipped" if step.skipped else "pending",
            finished_at=now if step.skipped else None,
        )
        for seq, step in enumerate(steps)
    )
    verb = "Queued" if start else "Planned"
    record_audit(
        db,
        action="data_job.create" if start else "data_job.plan",
        actor_id=actor_id,
        actor_name=actor_name,
        summary=(
            f"{verb} {timeframe} download of {len(symbols)} symbol(s), {first} to {last}"
            f" ({plan.requests} request(s), {skipped} step(s) already stored)"
        ),
        target_type="data_job",
        target_id=job.id,
        ip=ip,
    )
    return job


def _percent(done: int, total: int) -> Decimal:
    return Decimal(100) if total == 0 else Decimal(done * 100) / Decimal(total)
