# NOVA-077 — Atlas: tick archive as a data job

**Status:** done · **Owner:** Claude · **Branch:** task/NOVA-077 · **Depends on:** NOVA-076

## Goal
`POST /data-jobs/archive` queues an `archive` job that the Atlas worker runs, so old ticks move to Parquet
without the `archive-ticks` command (D54).

## Read first
- `AGENTS.md`, `docs/DECISIONS.md` D49, D54, `docs/tasks/NOVA-072.md`
- `backend/services/atlas/src/nova_atlas/{archive,jobs,worker,download}.py`

## Files
Modify:
- `backend/libs/nova_contracts/src/nova_contracts/{data_job,__init__}.py`, `tests/test_data_job.py`
- `frontend/packages/contracts/src/{dataJob,dataJob.test,jsonSchema.test}.ts`; `schema/ArchiveJobCreate.json` (create, generated)
- `backend/services/atlas/src/nova_atlas/{archive,jobs,worker}.py`, `tests/{test_archive,test_jobs_api,test_queue_worker}.py`
- `docs/guides/API.md`, `docs/CONTRACTS.md`

## Build
1. Contract `ArchiveJobCreate {before: IsoDate}`. Zod + Pydantic + parity.
2. `POST /data-jobs/archive` → 201 `DataJob` type `archive`, `queued`: `symbols` = distinct symbols with ticks
   received before `before` (IST), `from` = earliest such IST date, `to` = `before` − 1 day, segment
   `equity_delivery`, timeframe null. 400 "`before` must be today or earlier" and 400 "No ticks before
   YYYY-MM-DD". Audit `data_job.create` "Queued archive of ticks before YYYY-MM-DD".
3. `archive_ticks` also reports the number of ticks moved. Worker dispatches on `job.type`:
   `historical_download` → `run_download`, `archive` → `run_archive` (progress per day archived,
   `rows_written` = ticks moved, `completed` or `failed`). Cancel (072) stops between days.
4. CLI `archive-ticks` unchanged (it calls `archive_ticks` directly).

## Acceptance checks
- [ ] pytest: queue → 201 + fields above + audit; no ticks → 400; future date → 400; worker runs it:
      Parquet files written, ticks deleted, `rows_written` correct; cancelled between days stops.
- [ ] Existing archive and download tests pass.
- [ ] Definition of done in `AGENTS.md` §9.

## Out of scope
- Relay screen (078); automatic archiving on a schedule; reading archived ticks back.

## Questions

## Handoff
Built by Claude at the Owner's request. All acceptance checks pass.
- `ArchiveJobCreate` contract + schema; `queue_archive` + `POST /data-jobs/archive` in `jobs.py`.
- `archive.py`: `archive_ticks(…, on_day)` reports each day (and can stop), `archive_days`, `archive_symbols`,
  `run_archive`. `download._finish` is now public `finish_job` so both job kinds end the same way.
- Worker runs `historical_download` and `archive` (`WORKER_TYPES`), with `archive_dir` from settings.
- Download error for unsynced stocks now says "sync the stock list with Kite first" (no CLI name).
- Tests: new `test_archive_jobs.py`; atlas `conftest.py` also truncates `ticks`.
- Checks: `pnpm review:check` green (689); backend lint/types clean, pytest per package green (511).
- Guides: API, DATABASE, CONTRACTS.

## Review
Self-reviewed.
