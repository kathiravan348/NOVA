"""`python -m nova_atlas sync-instruments | download … | worker`."""

import argparse
import logging
import signal
import sys
import threading
from datetime import date

from nova_db import create_db_engine, create_session_factory, new_id
from nova_db.audit import record_audit
from nova_db.enums import SEGMENTS
from nova_db.models import DataJob
from sqlalchemy.orm import Session

from nova_atlas.broker_client import BrokerData, BrokerDataError
from nova_atlas.download import KITE_INTERVAL
from nova_atlas.settings import AtlasSettings, get_atlas_settings
from nova_atlas.universe import load_universe, sync_instruments
from nova_atlas.worker import run_worker

MAX_SYMBOLS = 200


def queue_download(
    db: Session, *, symbols: list[str], timeframe: str, first: date, last: date, segment: str
) -> DataJob:
    """Adds a `queued` historical download and audits it; the worker picks it up."""
    if not symbols or len(symbols) > MAX_SYMBOLS:
        raise ValueError(f"Give 1-{MAX_SYMBOLS} symbols")
    known = {row.symbol for row in load_universe()}
    unknown = [s for s in symbols if s not in known]
    if unknown:
        raise ValueError(f"Not in universe.csv: {', '.join(unknown)}")
    if timeframe not in KITE_INTERVAL:
        raise ValueError(f"Timeframe must be one of {', '.join(KITE_INTERVAL)}")
    if first > last:
        raise ValueError("--from must be on or before --to")
    if segment not in SEGMENTS:
        raise ValueError(f"Segment must be one of {', '.join(SEGMENTS)}")
    job = DataJob(
        id=new_id("job"),
        type="historical_download",
        status="queued",
        exchange="NSE",
        segment=segment,
        symbols=symbols,
        timeframe=timeframe,
        date_from=first,
        date_to=last,
    )
    db.add(job)
    record_audit(
        db,
        action="data_job.create",
        actor_id=None,
        actor_name="Console",
        summary=f"Queued {timeframe} download of {len(symbols)} symbol(s), {first} to {last}",
        target_type="data_job",
        target_id=job.id,
    )
    return job


def _broker(settings: AtlasSettings) -> BrokerData:
    return BrokerData(settings.broker_url, settings.internal_token.get_secret_value())


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="python -m nova_atlas")
    commands = parser.add_subparsers(dest="command", required=True)
    commands.add_parser("sync-instruments", help="update instruments from universe.csv + Kite")
    download = commands.add_parser("download", help="queue a historical download")
    download.add_argument("--symbols", required=True, help="comma-separated, e.g. INFY,TCS")
    download.add_argument("--timeframe", required=True, choices=list(KITE_INTERVAL))
    download.add_argument("--from", dest="first", required=True, type=date.fromisoformat)
    download.add_argument("--to", dest="last", required=True, type=date.fromisoformat)
    download.add_argument("--segment", default="equity_delivery", choices=list(SEGMENTS))
    commands.add_parser("worker", help="run data jobs until stopped")
    args = parser.parse_args(argv)
    logging.basicConfig(level=logging.INFO, format="%(name)s: %(message)s")

    settings = get_atlas_settings()
    engine = create_db_engine(settings.database_url.get_secret_value())
    factory = create_session_factory(engine)
    try:
        if args.command == "worker":
            stop = threading.Event()
            signal.signal(signal.SIGTERM, lambda *_: stop.set())
            signal.signal(signal.SIGINT, lambda *_: stop.set())
            run_worker(factory, _broker(settings), stop, settings.worker_poll_seconds)
            return 0
        with factory() as db:
            if args.command == "sync-instruments":
                result = sync_instruments(db, _broker(settings))
                print(f"Synced {len(result.synced)}; not on Kite NSE: {result.missing or 'none'}")
                return 0
            symbols = [s.strip().upper() for s in args.symbols.split(",") if s.strip()]
            job = queue_download(
                db,
                symbols=symbols,
                timeframe=args.timeframe,
                first=args.first,
                last=args.last,
                segment=args.segment,
            )
            db.commit()
            print(f"Queued {job.id}")
            return 0
    except (ValueError, BrokerDataError) as exc:
        print(exc, file=sys.stderr)
        return 1
    finally:
        engine.dispose()
