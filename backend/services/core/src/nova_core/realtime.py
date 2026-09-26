"""Realtime updates (D57): one WebSocket per signed-in screen, fed by Postgres NOTIFY.

A trigger on `data_jobs` (migration 0010) sends `{"type": "data_job.updated", "id": …}` on the
`nova_events` channel. One listener per Core process loads the job and sends the full `DataJob`
to every open socket, at most once per job per `COALESCE_SECONDS`.
"""

import asyncio
import contextlib
import json
import logging
import time
from dataclasses import dataclass, field

import psycopg
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from nova_contracts import DataJob as DataJobContract
from nova_contracts import DataJobUpdated
from nova_db.models import DataJob
from sqlalchemy.engine import make_url
from sqlalchemy.orm import Session, sessionmaker

from nova_core.deps import is_super_admin
from nova_core.sessions import COOKIE_NAME, resolve_session
from nova_core.settings import CoreSettings

CHANNEL = "nova_events"
COALESCE_SECONDS = 0.25
CLOSE_UNAUTHORIZED = 4401
QUEUE_SIZE = 256
MAX_BACKOFF_SECONDS = 30.0

log = logging.getLogger(__name__)
router = APIRouter()


def job_contract(job: DataJob) -> DataJobContract:
    return DataJobContract.model_validate(
        {
            "id": job.id,
            "type": job.type,
            "status": job.status,
            "exchange": job.exchange,
            "segment": job.segment,
            "symbols": job.symbols,
            "timeframe": job.timeframe,
            "from_": job.date_from,
            "to": job.date_to,
            "progress_percent": float(job.progress_percent),
            "rows_written": job.rows_written,
            "created_at": job.created_at,
            "started_at": job.started_at,
            "finished_at": job.finished_at,
            "error": job.error,
            "summary": job.summary,
        }
    )


def _libpq_url(database_url: str) -> str:
    """SQLAlchemy's `postgresql+psycopg://…` as a plain libpq URL for psycopg."""
    return make_url(database_url).set(drivername="postgresql").render_as_string(hide_password=False)


def signed_in_user_id(factory: sessionmaker[Session], token: str | None) -> str | None:
    """The super-admin behind a session cookie, or None (same rule as HTTP routes)."""
    if not token:
        return None
    with factory() as db:
        user = resolve_session(db, token)
        if user is None or not is_super_admin(db, user.id):
            return None
        return user.id


@dataclass
class Hub:
    """Open sockets and the NOTIFY listener of one Core process."""

    settings: CoreSettings
    factory: sessionmaker[Session]
    clients: set["asyncio.Queue[str]"] = field(default_factory=set)
    # Set after the first connect attempt, success or not: startup waits for it.
    ready: asyncio.Event = field(default_factory=asyncio.Event)
    _last_sent: dict[str, float] = field(default_factory=dict)
    _pending: set[str] = field(default_factory=set)
    _tasks: set["asyncio.Task[None]"] = field(default_factory=set)

    def subscribe(self) -> "asyncio.Queue[str]":
        queue: asyncio.Queue[str] = asyncio.Queue(QUEUE_SIZE)
        self.clients.add(queue)
        return queue

    def unsubscribe(self, queue: "asyncio.Queue[str]") -> None:
        self.clients.discard(queue)

    def broadcast(self, text: str) -> None:
        for queue in list(self.clients):
            with contextlib.suppress(asyncio.QueueFull):
                # A socket this far behind drops messages; the screen's polling fallback catches up.
                queue.put_nowait(text)

    def notice(self, payload: str) -> None:
        try:
            event = json.loads(payload)
        except ValueError:
            return
        if not isinstance(event, dict) or event.get("type") != "data_job.updated":
            return
        job_id = event.get("id")
        if not isinstance(job_id, str) or job_id in self._pending:
            return  # a send for this job is already scheduled and will load the latest row
        self._pending.add(job_id)
        task = asyncio.create_task(self._send_job(job_id))
        self._tasks.add(task)
        task.add_done_callback(self._tasks.discard)

    async def _send_job(self, job_id: str) -> None:
        wait = self._last_sent.get(job_id, 0.0) + COALESCE_SECONDS - time.monotonic()
        if wait > 0:
            await asyncio.sleep(wait)
        # Cleared before loading, so a change committed after the read schedules another send;
        # the send time is taken now, so that one waits a full window.
        self._pending.discard(job_id)
        now = time.monotonic()
        if len(self._last_sent) > 1000:
            self._last_sent = {
                k: v for k, v in self._last_sent.items() if now - v < COALESCE_SECONDS
            }
        self._last_sent[job_id] = now
        contract = await asyncio.to_thread(self._load, job_id)
        if contract is not None:
            message = DataJobUpdated(type="data_job.updated", data=contract)
            self.broadcast(message.model_dump_json())

    def _load(self, job_id: str) -> DataJobContract | None:
        with self.factory() as db:
            job = db.get(DataJob, job_id)
            return job_contract(job) if job is not None else None

    async def listen_forever(self) -> None:
        """LISTEN on `nova_events`; reconnect with backoff and log once per outage."""
        url = _libpq_url(self.settings.database_url.get_secret_value())
        backoff = 1.0
        down = False
        while True:
            try:
                async with await psycopg.AsyncConnection.connect(url, autocommit=True) as conn:
                    await conn.execute(f"LISTEN {CHANNEL}")
                    if down:
                        log.info("realtime: listening again")
                    down, backoff = False, 1.0
                    self.ready.set()
                    async for notify in conn.notifies():
                        self.notice(notify.payload)
            except asyncio.CancelledError:
                raise
            except Exception:  # any connection error: retry, the screens poll meanwhile
                self.ready.set()
                if not down:
                    log.warning("realtime: lost the database listener, retrying", exc_info=True)
                    down = True
                await asyncio.sleep(backoff)
                backoff = min(backoff * 2, MAX_BACKOFF_SECONDS)


def _hub(websocket: WebSocket) -> Hub:
    hub: Hub = websocket.app.state.realtime
    return hub


@router.websocket("/ws")
async def realtime_socket(websocket: WebSocket) -> None:
    hub = _hub(websocket)
    token = websocket.cookies.get(COOKIE_NAME)
    await websocket.accept()
    if await asyncio.to_thread(signed_in_user_id, hub.factory, token) is None:
        # Accept first, so the browser sees 4401 instead of a failed handshake.
        await websocket.close(code=CLOSE_UNAUTHORIZED)
        return
    queue = hub.subscribe()
    queue.put_nowait('{"type":"hello"}')
    tasks = [
        asyncio.create_task(_writer(websocket, queue)),
        asyncio.create_task(_pinger(hub, queue)),
        asyncio.create_task(_session_guard(hub, websocket, token)),
        asyncio.create_task(_reader(websocket)),
    ]
    try:
        # The first task to end (client left, send failed, session revoked) ends the others.
        await asyncio.wait(tasks, return_when=asyncio.FIRST_COMPLETED)
    finally:
        hub.unsubscribe(queue)
        for task in tasks:
            task.cancel()
        await asyncio.gather(*tasks, return_exceptions=True)


async def _writer(websocket: WebSocket, queue: "asyncio.Queue[str]") -> None:
    while True:
        await websocket.send_text(await queue.get())


async def _pinger(hub: Hub, queue: "asyncio.Queue[str]") -> None:
    while True:
        await asyncio.sleep(hub.settings.ws_ping_seconds)
        with contextlib.suppress(asyncio.QueueFull):
            queue.put_nowait('{"type":"ping"}')


async def _session_guard(hub: Hub, websocket: WebSocket, token: str | None) -> None:
    while True:
        await asyncio.sleep(hub.settings.ws_session_check_seconds)
        if await asyncio.to_thread(signed_in_user_id, hub.factory, token) is None:
            await websocket.close(code=CLOSE_UNAUTHORIZED)
            return


async def _reader(websocket: WebSocket) -> None:
    """Client messages are ignored (only `pong` is expected); returns when the client leaves."""
    with contextlib.suppress(WebSocketDisconnect):
        while True:
            await websocket.receive_text()
