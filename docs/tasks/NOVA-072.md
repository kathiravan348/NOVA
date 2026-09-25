# NOVA-072 — Atlas: queue and cancel data jobs over HTTP

**Status:** planned · **Owner:** — · **Branch:** task/NOVA-072 · **Depends on:** NOVA-061

## Goal
`POST /data-jobs` queues a historical download and `POST /data-jobs/{id}/cancel` cancels a queued or running
job, with the same checks as the `download` CLI, audited with the signed-in user (D54). No screen yet (073).

## Read first
- `AGENTS.md`, `docs/DECISIONS.md` D41, D52, D54
- `backend/services/atlas/src/nova_atlas/{cli,jobs,download}.py`
- `backend/services/broker/src/nova_broker/accounts.py` (`create_account`: POST + audit pattern)

## Files
Modify:
- `backend/libs/nova_contracts/src/nova_contracts/{data_job,__init__}.py`, `tests/test_data_job.py`
- `backend/services/atlas/src/nova_atlas/{jobs,cli}.py`, `tests/test_jobs_api.py`
- `frontend/packages/contracts/src/{dataJob,dataJob.test,jsonSchema.test}.ts`
- `frontend/packages/contracts/schema/DataJobCreate.json` (create, generated: `schema:update`)
- `docs/guides/API.md`, `docs/CONTRACTS.md`

## Build
1. Contract `DataJobCreate {symbols, timeframe, from, to, segment?}`: symbols 1–200 non-empty strings,
   timeframe from `Timeframe`, `from ≤ to` (IsoDate), segment default `equity_delivery`. Zod + Pydantic +
   schema file + parity test.
2. Move `queue_download` (+ `MAX_SYMBOLS`) from `cli.py` to `jobs.py`; add `actor_id`, `actor_name`, `ip`
   parameters (CLI passes `None`, `"Console"`, `None`). Symbols are trimmed and upper-cased there. CLI unchanged.
3. `POST /data-jobs` → 201 `DataJob` (`queued`). `ValueError` → 400 `invalid_request` with its message
   (unknown symbols, bad dates, …). Audit `data_job.create` as today.
4. `POST /data-jobs/{id}/cancel` → 200 `DataJob`. Allowed for `queued` and `running`; `queued` also gets
   `finished_at`. Other statuses → 400 "Job is already completed|failed|cancelled"; unknown id → 404.
   Audit `data_job.cancel` "Cancelled <timeframe> download of N symbol(s)" (target `data_job`).
   A running download stops before its next chunk (existing check in `run_download`).

## Acceptance checks
- [ ] pytest: create → 201 + parity-valid + audit row with the caller's id/name; unknown symbol, `from > to`,
      201 symbols → 400; cancel queued → `cancelled` + `finished_at`; cancel running → `cancelled` and the
      worker test stops at the next chunk; cancel completed → 400; unknown → 404; no internal token → 401.
- [ ] `download` CLI tests still pass.
- [ ] Definition of done in `AGENTS.md` §9.

## Out of scope
- Relay screens (NOVA-073); archive and tick jobs (NOVA-076); universe changes (NOVA-074).
- Retrying a failed job (queue a new one instead).

## Questions

## Handoff

## Review
