# NOVA-090 — Core: WebSocket `/api/v1/ws` with data-job events from Postgres NOTIFY

**Status:** planned · **Owner:** — · **Branch:** task/NOVA-090 · **Depends on:** NOVA-085

## Goal
A signed-in screen opens one WebSocket to NOVA Core and receives `data_job.updated` whenever any data job
row is inserted or changed (D57 (1)). No screen uses it yet (091).

## Read first
- `AGENTS.md`, `docs/DECISIONS.md` D48, D57
- `backend/services/core/src/nova_core/{main,deps,sessions,auth_routes,gateway,settings}.py`, `tests/conftest.py`
- `backend/libs/nova_db/src/nova_db/migrations/versions/rev0009_market_indices.py` (from 085)
- The data job contract (`docs/CONTRACTS.md` → `DataJob`)

## Files
Create:
- `backend/libs/nova_db/src/nova_db/migrations/versions/rev0010_job_notify.py`
- `backend/services/core/src/nova_core/realtime.py`, `tests/test_realtime.py`
- `backend/libs/nova_contracts/src/nova_contracts/realtime.py` + test; `frontend/packages/contracts/src/realtime.ts` + test
Modify:
- `backend/services/core/src/nova_core/main.py`, `settings.py`
- `backend/libs/nova_db/tests/test_migrations.py`, `backend/libs/nova_contracts/src/nova_contracts/__init__.py`
- `frontend/packages/contracts/src/{index,jsonSchema.test}.ts`
- `docs/guides/{API,DATABASE}.md`, `docs/CONTRACTS.md`, `docs/ARCHITECTURE.md` (realtime line; Claude-owned, reviewer adds)

## Build
1. Migration 0010: function + `AFTER INSERT OR UPDATE` trigger on `data_jobs` →
   `pg_notify('nova_events', json_build_object('type','data_job.updated','id',NEW.id)::text)`. Downgrade drops both.
2. `realtime.py`: one background task per Core process holds a psycopg async connection with `LISTEN nova_events`
   (reconnects with backoff, logs once per outage). On a notice it loads the job, maps it to the `DataJob`
   contract and sends `{"type":"data_job.updated","data":<DataJob>}` to every open socket.
   Coalesce: at most one message per job id per 250 ms.
3. `@app.websocket("/api/v1/ws")`: accept only with a valid session cookie (same check as HTTP; else close 4401).
   Server sends `{"type":"hello"}` on connect and `{"type":"ping"}` every 25 s; client messages are ignored
   except `{"type":"pong"}`. Close sockets whose session is revoked or expired (check every 60 s).
4. Contract `RealtimeMessage` = union of `hello`, `ping`, `data_job.updated {data: DataJob}` (Zod + Pydantic + parity).

## Acceptance checks
- [ ] pytest: no cookie → 4401; with cookie → hello; updating a job row → one `data_job.updated` with the contract shape.
- [ ] pytest: 10 quick updates of one job within 250 ms → 1–2 messages, last one has the final state.
- [ ] Migration up/down test.
- [ ] Definition of done in `AGENTS.md` §9.

## Out of scope
- Frontend (091). Redis pub/sub, live prices, orders. Client → server commands.

## Questions

## Handoff

## Review
