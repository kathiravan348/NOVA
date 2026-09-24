# NOVA-051 — Atlas: instrument sync, historical downloads (Postgres job queue), data-jobs endpoints

**Status:** done · **Owner:** Claude · **Branch:** task/NOVA-051 · **Depends on:** NOVA-050

## Goal
NOVA Atlas downloads historical candles from Kite into the `candles` hypertable as data jobs run by a worker, and
serves the data-jobs list. Only the broker talks to Kite: Atlas asks it through internal endpoints that take a
rate-limiter slot first (D35, D40, D41). Market-data endpoints follow in NOVA-061.

## Read first
- `AGENTS.md` (§8, §10), `docs/DECISIONS.md` (D11, D32, D35, D37, D40, D41), `frontend/packages/contracts/src/dataJob.ts`
- `backend/services/broker/src/nova_broker/{kite.py,limiter.py,main.py,deps.py}`, `nova_db/models/data.py`

## Files
Broker: `nova_broker/{kite.py,internal.py,main.py,deps.py}`, `tests/test_internal.py`, `nova_testing/kite.py` (data endpoints)
Atlas (create): `backend/services/atlas/{pyproject.toml,src/nova_atlas/{__init__.py,py.typed,settings.py,main.py,
broker_client.py,universe.py,data/universe.csv,queue.py,download.py,worker.py,jobs.py,cli.py,__main__.py},tests/*}`
Contracts: `nova_contracts/data_job.py` + `tests/test_data_job.py`, `__init__.py`
Also: `backend/pyproject.toml`, `uv.lock`, `compose.yaml` (`atlas`, `atlas-worker`; core `NOVA_ATLAS_URL`),
`docs/{DECISIONS,STRUCTURE,CONTRACTS,PLAN}.md`, `docs/tasks/BOARD.md` (061 split out), `backend/README.md`

## Build
1. `KiteClient.instruments(exchange, access_token)` (CSV) and `historical(token, interval, from, to, access_token)`.
   Broker `GET /internal/kite/instruments/{exchange}` and `/internal/kite/historical`: internal token only (no user),
   outside `/api/v1` so the gateway never forwards them; first enabled account with an active session; wait for a
   limiter slot (`other` / `historical`, ≤ 20 s); no session → 400 `invalid_request` "Log in to Kite in Relay first".
2. Pydantic `DataJob` (4 refinements); parity vs mock.
3. `data/universe.csv` (symbol, name, sector, indices) seeded from the 24 mock instruments; the Owner edits it.
   `python -m nova_atlas sync-instruments`: NSE `EQ` rows → token; nearest NFO `FUT` → lot size; upsert `instruments`.
4. Queue (D41): `claim_next` = oldest `queued` job `FOR UPDATE SKIP LOCKED` → `running`; worker requeues `running`
   jobs at start (one worker in Phase 1), polls every 2 s, stops on SIGTERM.
5. Download: per symbol, Kite-sized chunks (1m 60 d, 3m/5m 100 d, 15m/30m 200 d, 1h 400 d, 1d 2000 d); prices →
   paise with `Decimal`; upsert candles; commit progress + rows per chunk; stop if the job was cancelled; any error →
   `failed` with a short message. `python -m nova_atlas download --symbols --timeframe --from --to` queues a job and
   audits `data_job.create`.
6. `GET /data-jobs` (`Page<DataJob>`, newest first, keyset `(created_at, id)`), `GET /data-jobs/{id}`.

## Acceptance checks
- [x] Tests (fake Kite / fake broker): internal endpoints + limiter, sync, chunking, download success/failure/cancel,
      two workers never claim one job, data-jobs paging and schema.
- [x] `backend-check` passes; `docker compose up -d` runs atlas + worker. Definition of done in `AGENTS.md` §9.

## Out of scope
- Market-data endpoints (061), tick recording (052), a download screen, index/benchmark instruments.

## Handoff
**Done:** Built by Claude on Owner request (2026-09-25). Broker `/internal/kite/*`, Atlas sync/queue/worker/download, data-jobs API.
**Commands run:** `backend-check` pass (209 tests); e2e: stack up with atlas + worker → `sync-instruments` reports "Kite
API key and secret are not configured" → queued download fails "Unknown instruments…" → visible via Core `/data-jobs`.
**New dependencies:** none.
**Deviations:** `nova_db.paging.newest_first` (keyset pages, `/audit` now uses it); `nova_testing.broker.FakeBroker`;
the worker marks a crashing job failed and keeps serving. Universe = the 24 mock instruments (Owner edits the file).
**Known gaps:** real data needs the Kite key + daily login; no screen to queue downloads (CLI only, frozen scope).

## Review
**Result:** done
**Fixed directly:** FakeKite CSV literals broken by shell escaping (rewritten); `dict()` over a SQLAlchemy result;
variable shadowing found by mypy; worker hardened against unexpected job errors (test added).
**Rulebook issues found:** none (Kite only in broker; `/internal` outside `/api/v1`). **Follow-up tasks created:** NOVA-061.
