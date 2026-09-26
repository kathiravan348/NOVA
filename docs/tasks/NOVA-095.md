# NOVA-095 — Atlas: delete finished data jobs, optionally with their candles

**Status:** done · **Owner:** Claude · **Branch:** task/NOVA-095 · **Depends on:** NOVA-093

## Goal
The Owner can remove test or unwanted jobs over HTTP (Owner request 2026-09-26): a finished job row goes, and
for a download its candles can go too. Open screens hear about it over the WebSocket (D57).

## Read first
- `AGENTS.md`, `docs/DECISIONS.md` D41, D57
- `backend/services/atlas/src/nova_atlas/{jobs,job_control}.py`, `tests/test_plan.py`
- `backend/libs/nova_db/src/nova_db/migrations/versions/rev0010_job_notify.py`
- `backend/services/core/src/nova_core/realtime.py`, `tests/test_realtime.py`

## Files
Create:
- `backend/libs/nova_db/src/nova_db/migrations/versions/rev0012_job_delete_notify.py`
- `backend/services/atlas/tests/test_job_delete.py`
Modify:
- `backend/services/atlas/src/nova_atlas/job_control.py`, `backend/services/core/src/nova_core/realtime.py`, `tests/test_realtime.py`
- `backend/libs/nova_db/tests/test_migrations.py`
- Contracts: `realtime` + `dataJob` (Zod + Pydantic + tests, schemas); `jsonSchema.test.ts`
- `docs/guides/{API,DATABASE}.md`, `docs/CONTRACTS.md`

## Build
1. `DELETE /data-jobs/{id}?candles=true|false` (default false). Allowed for `draft`, `completed`, `failed`,
   `cancelled`; 400 "Cancel or finish the job first" for `queued`/`running`/`paused`; 404 unknown.
   Steps go by cascade. `candles=true` only for `historical_download` (400 otherwise): deletes `candles` rows of
   the job's exchange, symbols and timeframe from `from` 00:00 IST to `to` + 1 day 00:00 IST.
   Answers `DataJobDeleteResult {id, candlesDeleted}`. Audit `data_job.delete` (exists since 0011):
   "Deleted 1m download of 1 symbol(s) and 91,723 candles".
2. Migration 0012: the notify trigger also fires `AFTER DELETE` with `{"type":"data_job.deleted","id":OLD.id}`.
3. Core: `data_job.deleted` → `{"type":"data_job.deleted","data":{"id":…}}` at once (no row to load).
   Contract `RealtimeMessage` gains that member.

## Acceptance checks
- [ ] pytest: delete a completed download with and without candles (only its symbols/timeframe/period go);
      queued/running/paused → 400; candles on a sync job → 400; 404; audit row.
- [ ] pytest (Core): deleting a job row sends one `data_job.deleted`.
- [ ] Migration up/down; contract parity.
- [ ] Definition of done in `AGENTS.md` §9.

## Out of scope
- Screens (096). Deleting ticks or Parquet files. Bulk delete.

## Questions

## Handoff
**Done:** `DELETE /data-jobs/{id}?candles=` (+ audit), migration 0012 (delete notify), Core `data_job.deleted`, contracts `DataJobDeleteResult` and the realtime member.
**Files changed:** as listed. **Commands run:** backend-check (661 passed) · `pnpm review:check` → pass.
**New dependencies:** none. **Maps updated:** CONTRACTS. **Guides updated:** API, DATABASE.
**Deviations from task:** none. **Known gaps:** screens and cache handling (096).

## Review
**Result:** done (built and merged by Claude at the Owner's request).
**Guides checked:** API, DATABASE, CONTRACTS match. **Rulebook issues found:** none. **Follow-up tasks created:** none.
