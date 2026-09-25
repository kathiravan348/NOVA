"""`python -m nova_atlas sync-instruments | download … | worker | archive-ticks`."""

import argparse
import logging
import signal
import sys
import threading
from datetime import date

from nova_db import create_db_engine, create_session_factory
from nova_db.enums import SEGMENTS

from nova_atlas.archive import archive_ticks
from nova_atlas.broker_client import BrokerData, BrokerDataError
from nova_atlas.download import KITE_INTERVAL
from nova_atlas.jobs import queue_download
from nova_atlas.settings import AtlasSettings, get_atlas_settings
from nova_atlas.universe import sync_instruments
from nova_atlas.worker import run_worker


def _broker(settings: AtlasSettings) -> BrokerData:
    return BrokerData(settings.broker_url, settings.internal_token.get_secret_value())


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="python -m nova_atlas")
    commands = parser.add_subparsers(dest="command", required=True)
    commands.add_parser("sync-instruments", help="update instruments from the stock list + Kite")
    download = commands.add_parser("download", help="queue a historical download")
    download.add_argument("--symbols", required=True, help="comma-separated, e.g. INFY,TCS")
    download.add_argument("--timeframe", required=True, choices=list(KITE_INTERVAL))
    download.add_argument("--from", dest="first", required=True, type=date.fromisoformat)
    download.add_argument("--to", dest="last", required=True, type=date.fromisoformat)
    download.add_argument("--segment", default="equity_delivery", choices=list(SEGMENTS))
    commands.add_parser("worker", help="run data jobs until stopped")
    archive = commands.add_parser("archive-ticks", help="move old ticks to Parquet")
    archive.add_argument("--before", required=True, type=date.fromisoformat, help="IST date")
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
            run_worker(
                factory,
                _broker(settings),
                stop,
                settings.worker_poll_seconds,
                archive_dir=settings.archive_dir,
            )
            return 0
        with factory() as db:
            if args.command == "archive-ticks":
                written = archive_ticks(db, settings.archive_dir, args.before)
                print(f"Archived {len(written)} file(s) under {settings.archive_dir}")
                return 0
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
