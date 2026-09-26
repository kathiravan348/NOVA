# NOVA-092 — Download plans: draft/paused statuses, job steps, market-hours setting

**Status:** done · **Owner:** Claude · **Branch:** task/NOVA-092 · **Depends on:** NOVA-090

## Goal
Tables and contracts for planned, resumable downloads (D57 (2)–(5)). No planning logic yet (093).

## Read first
- `AGENTS.md`, `docs/DECISIONS.md` D41, D54, D57
- `backend/libs/nova_db/src/nova_db/{enums.py,models/data.py,queue.py}`, `migrations/versions/rev0010_job_notify.py`
- The data job contracts (Pydantic + `frontend/packages/contracts/src/dataJob.ts`)

## Files
Create:
- `backend/libs/nova_db/src/nova_db/migrations/versions/rev0011_job_plans.py`
- `frontend/packages/contracts/src/schema/{DataJobPlan,DataJobPlanRequest,DownloadSettings}.json` (generated)
Modify:
- `backend/libs/nova_db/src/nova_db/{enums.py,models/data.py,models/__init__.py,queue.py}`, `tests/{test_migrations,test_constraints,test_queue}.py`
- Data job contracts (Pydantic + Zod) + tests; `frontend/packages/contracts/src/{index,jsonSchema.test}.ts`
- `frontend/packages/mocks/src/data.ts`
- `docs/guides/DATABASE.md`, `docs/CONTRACTS.md`

## Build
1. Migration 0011:
   - `data_jobs.status` gains `draft` and `paused`; new columns `mode` (`skip_existing`|`overwrite`, null for non-downloads),
     `plan` jsonb null, `expires_at` timestamptz null (drafts only). `queued` CHECK stays; `draft` has no started/finished.
   - Table `data_job_steps`: PK (`job_id` FK cascade, `seq`), `symbol`, `start_at`, `end_at` (UTC), `status`
     (`pending`|`done`|`skipped`), `rows_written` int default 0, `finished_at` null. Index (`job_id`, `status`, `seq`).
   - Single-row table `download_settings`: `market_hours_mode` (`slow`|`full`, default `slow`), `updated_at`, `updated_by`.
   - Audit actions `data_job.plan`, `data_job.start`, `data_job.pause`, `data_job.resume`, `download_settings.update`.
2. `queue.py`: `claim_next` never claims `draft` or `paused`; `requeue_running` leaves step rows untouched.
3. Contracts:
   - `DataJobPlanRequest` = the download create body + `mode`.
   - `DataJobPlan {steps, skippedSteps, requests, estimatedRows, estimatedBytes, estimatedSeconds, estimatedStartAt,
     jobsAhead, perSymbol: [{symbol, steps, skippedSteps, existingFrom|null, existingTo|null}], warnings: string[]}`.
   - `DataJob` gains `mode`, `plan` (`DataJobPlan|null`), `stepsDone`, `stepsTotal`, `expiresAt`; statuses gain `draft`, `paused`.
   - `DownloadSettings {marketHoursMode}` + update body.

## Acceptance checks
- [ ] Migration up/down; constraint tests for the new statuses and step rows.
- [ ] Queue test: a `draft` and a `paused` job are never claimed.
- [ ] Contract, parity and mock tests pass.
- [ ] Definition of done in `AGENTS.md` §9.

## Out of scope
- Endpoints, worker, estimates (093). Screens (094).

## Questions

## Handoff
**Done:** migration 0011 (statuses `draft`/`paused`, `mode`, `plan`, `expires_at`, `steps_total`/`steps_done`, `data_job_steps`, `download_settings`, audit actions), models, contracts (Zod + Pydantic + schemas), mocks.
**Files changed:** as listed; plus Atlas `jobs.py` and Core `realtime.py` (map new fields), Relay `lib/labels.ts` (new statuses and actions), broker test truncate.
**Commands run:** backend-check (635 passed) · `pnpm review:check` → pass.
**New dependencies:** none. **Maps updated:** CONTRACTS. **Guides updated:** DATABASE.
**Deviations from task:** added `steps_total`/`steps_done` on `data_jobs` (each step updates the job row, so the socket reports step progress) and audit action `data_job.delete` (for NOVA-095, saves a migration). Queue tests live in `nova_db/tests/test_queue.py` (new). `claim_next` already only takes `queued`.
**Known gaps:** endpoints and worker (093).

## Review
**Result:** done (built and merged by Claude at the Owner's request).
**Fixed directly:** JSONB `plan` stores None as SQL NULL (`none_as_null`); audit group for `download_settings.update` is Settings.
**Guides checked:** DATABASE, CONTRACTS match. **Rulebook issues found:** none. **Follow-up tasks created:** NOVA-095, NOVA-096 (delete jobs).
