# NOVA-084 — Data jobs: batched candle writes, clear failure reasons, job screens refresh

**Status:** done · **Owner:** Claude · **Branch:** task/NOVA-084 · **Depends on:** NOVA-083

## Goal
A 1-year 1-minute download completes (today it crashes: one INSERT carries > 65,535 values). Every failed
job says in plain words what went wrong and what to do. The job page and list refresh on their own while a
job is queued or running (D56 (5)).

## Read first
- `AGENTS.md`, `docs/DECISIONS.md` D41, D56
- `backend/services/atlas/src/nova_atlas/{download,worker,broker_client}.py`, `tests/test_download.py`, `tests/test_queue_worker.py`
- `frontend/packages/services/src/queries/relay.ts` (`useDataJobs`, `useDataJob`)
- `frontend/apps/nova-relay/src/pages/data-jobs/{DataJobDetailPage,DataJobsPage}.tsx`, `dataJobs.test.tsx`

## Files
Modify:
- `backend/services/atlas/src/nova_atlas/{download,worker,broker_client}.py`, `tests/test_download.py`, `tests/test_queue_worker.py`
- `frontend/packages/services/src/queries/relay.ts`, `frontend/packages/services/src/queries/queries.test.tsx`
- `frontend/apps/nova-relay/src/pages/data-jobs/dataJobs.test.tsx`
- `docs/guides/USER-GUIDE.md` ("what do I do if" rows for each failure message)

## Build
1. `upsert_candles`: insert in batches of `CANDLE_BATCH = 5000` rows (one statement per batch, same
   transaction); return the total. Keep `ON CONFLICT` behaviour unchanged.
2. Failure messages (≤ 200 chars, never SQL, parameters, tokens or URLs with keys):
   - Broker says no session / expired → "Kite is not logged in today. Log in on the Broker page, then start the download again."
   - Broker unreachable → "The broker service did not answer. Check that the stack is running, then try again."
   - Kite rate limit / other broker message → "Kite refused the request: <broker message>"
   - Unknown symbols → keep today's text, but say "Run **Sync with Kite** on Instruments first".
   - Worker crash handler: "Unexpected error (<ExceptionClass>): <first line of str(exc), ≤ 120 chars>. The worker log has details."
     First line only: SQLAlchemy puts SQL and parameters on later lines.
   Map broker cases in `broker_client.py` from the HTTP status / error code the broker returns (read `test_download.py` fakes).
3. `useDataJob`: `refetchInterval` 3 s while `status` is `queued` or `running`, otherwise off.
   `useDataJobs`: 5 s while any loaded row is `queued` or `running`, otherwise off.
   When a job detail fetch returns a new status, also invalidate `queryKeys.dataJobs.list` (and vice versa is not needed).

## Acceptance checks
- [ ] pytest: 12,000 fake 1-minute bars in one chunk are written (3 statements), `rows_written == 12000`.
- [ ] pytest: each failure case above stores its exact message; crash message has no newline.
- [ ] Vitest (fake timers): a queued job's page shows **RUNNING** after the next poll, then **COMPLETED**; polling stops after that.
- [ ] Real stack: re-run the failed AXISBANK 1-year 1m download → completes.
- [ ] Definition of done in `AGENTS.md` §9.

## Out of scope
- Retrying failed jobs automatically. Changing chunk sizes. Server push (SSE/WebSocket).

## Questions

## Handoff
Built by Claude at the Owner's request.
- `upsert_candles` writes `CANDLE_BATCH = 5000` rows per INSERT (root cause of the AXISBANK failures:
  a 60-day 1m chunk × 8 columns > 65,535 values).
- `broker_client.explain()` maps broker answers to plain messages (`NOT_LOGGED_IN`, `NO_ANSWER`, "Kite refused
  the request: …"); `worker.crash_message()` keeps the class and first line only.
- `useDataJob` polls 3 s / `useDataJobs` 5 s while active (`JOB_POLL_MS`, exported so tests can shorten it);
  a detail status change invalidates the list.
- Also touched: `libs/nova_testing/.../broker.py` (`error_status`). `queries.test.tsx` not needed: the Relay test covers polling.
- Checks: `pnpm review:check` green; backend ruff/format/mypy clean, every package's pytest green (host).
- Guides: USER-GUIDE ("what do I do if" rows).

## Review
Self-reviewed. Real stack: the failed AXISBANK 1y 1m job re-run on the rebuilt worker → completed, 91,723 rows.
