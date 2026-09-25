# NOVA-076 — Broker: always-on tick recorder with an on/off setting

**Status:** done · **Owner:** Claude · **Branch:** task/NOVA-076 · **Depends on:** NOVA-074

## Goal
The tick recorder container runs all the time. A `recorder_settings` row (on/off + symbols), changed over
HTTP, decides whether it records 09:15–15:30 IST on weekdays; each session is a `tick_record` data job (D54).

## Read first
- `AGENTS.md`, `docs/DECISIONS.md` D49, D54
- `backend/services/broker/src/nova_broker/{cli,recorder,internal,main}.py`, `compose.yaml` (`tick-recorder`)
- `backend/services/broker/src/nova_broker/rate_limits.py` (GET/PATCH + `settings`-style audit pattern)

## Files
Create:
- `backend/libs/nova_db/src/nova_db/migrations/versions/rev0007_recorder_settings.py`
- `backend/libs/nova_contracts/src/nova_contracts/recorder.py`, `tests/test_recorder.py`
- `frontend/packages/contracts/src/recorder.ts`, `recorder.test.ts`; `schema/{RecorderSettings,RecorderSettingsUpdate}.json` (generated)
- `backend/services/broker/src/nova_broker/{recorder_settings,recorder_loop}.py`, `tests/{test_recorder_settings,test_recorder_loop}.py`
Modify:
- `backend/libs/nova_db/src/nova_db/{models/data.py,models/__init__.py}`, `tests/test_migrations.py`
- `backend/libs/nova_contracts/src/nova_contracts/__init__.py`; `frontend/packages/contracts/src/{index,jsonSchema.test}.ts`
- `backend/services/broker/src/nova_broker/{cli,main}.py`; `compose.yaml`
- `backend/README.md`, `README.md`, `docs/guides/{API,DATABASE}.md`, `docs/CONTRACTS.md`

## Build
1. Migration 0007: `recorder_settings` — `id` smallint PK CHECK `id = 1`, `enabled` bool default false,
   `symbols` text[] default `{}`, `updated_at`; insert the one row (off).
2. Contracts: `RecorderSettings {enabled, symbols, state, jobId, updatedAt}`, `state` ∈ `off`, `waiting`,
   `recording`, `no_login` (on, market hours, but no active Kite session); `RecorderSettingsUpdate
   {enabled, symbols}` (≤ `MAX_TOKENS`; empty = every synced instrument). Zod + Pydantic + parity.
3. `GET /broker/recorder`; `PUT /broker/recorder` → 200, 400 for symbols without an instrument token.
   Audit `settings.update` "Tick recording on: 12 symbols" / "Tick recording off" (target `settings`).
4. `recorder_loop.py`: every 30 s reads the row. When on, a weekday and 09:15 ≤ IST < 15:30 with an active
   session: create a `tick_record` job (`running`, symbols, `started_at`), run `Recorder` with `should_stop`
   = SIGTERM, 15:30, or the setting turned off (checked every 5 s); the sink adds to `rows_written`; then
   `completed` (100%) or `failed` with the error. `state`/`jobId` come from the setting + the running job.
   Clock, sleep and connect are injectable; tests never open a socket (fake socket, fixed clock).
5. CLI: new `recorder` command runs the loop; `record-ticks` stays for manual runs.
6. Compose `tick-recorder`: drop the `market` profile, `command` = `recorder`, `restart: unless-stopped`.
   Update both READMEs (no more `--profile market` step).

## Acceptance checks
- [ ] pytest: settings GET/PUT + audit + 400; loop: off → no job; on in hours → job running then `completed`
      at 15:30 with rows; turned off mid-session → job ends; no session → `no_login`, no job; weekend → no job.
- [ ] `docker compose up -d` starts `nova-tick-recorder` and it idles with the setting off.
- [ ] Definition of done in `AGENTS.md` §9.

## Out of scope
- Relay screen (078); NSE holiday calendar (a holiday gives a job with 0 rows); archive (077).

## Questions

## Handoff
Built by Claude at the Owner's request. All acceptance checks pass.
- Migration 0007 `recorder_settings` (one row, off); contracts `RecorderSettings(+Update)` + schemas.
- `recorder_settings.py`: GET/PUT `/broker/recorder` (audit `settings.update`, target `settings`/`recorder`).
- `recorder_loop.py`: `RecorderLoop` (injectable clock + record); `tick_symbols` moved here from `cli.py`;
  cancelling a running `tick_record` job in Relay stops it and turns the switch off; a failure waits 5 min.
- Not listed but needed: `nova_db/queue.py` takes an optional `condition`; the Atlas worker only requeues
  and claims `historical_download` (else it would grab the recorder's jobs). Atlas test for that; the
  broken-job test now breaks `run_download` with monkeypatch instead of an `archive` row.
- Compose: `tick-recorder` has no profile, runs `recorder`, `restart: unless-stopped`.
- Checks: `pnpm review:check` green (687); backend lint/types clean, pytest per package green (505).
- Guides: API, DATABASE (0007), CONTRACTS, STRUCTURE, both READMEs.

## Review
Self-reviewed. Note: Compose mem limits already add up to more than the 4 GB of AGENTS.md §5a
(5.1 GB before, 5.4 GB with the always-on recorder); flagged to the Owner, not changed here.
