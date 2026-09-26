# NOVA-093 — Atlas: plan, coverage check, Start/Pause/Resume, step-by-step worker, market-hours pace

**Status:** planned · **Owner:** — · **Branch:** task/NOVA-093 · **Depends on:** NOVA-087, NOVA-092

## Goal
A download is planned (what exists, what is left, how long) before it runs, starts only on approval, can be
paused and resumed, survives a restart, and slows down in market hours (D57 (2)–(6)).

## Read first
- `AGENTS.md`, `docs/DECISIONS.md` D41, D57
- `backend/services/atlas/src/nova_atlas/{download,jobs,worker,universe_api}.py`, `tests/{conftest,test_download,test_queue_worker}.py`
- `backend/services/broker/src/nova_broker/limits.py` (read only: historical 3/s, NOVA rule 2/s)

## Files
Create:
- `backend/services/atlas/src/nova_atlas/plan.py`, `tests/test_plan.py`, `tests/test_pause_resume.py`
Modify:
- `backend/services/atlas/src/nova_atlas/{download,jobs,worker,universe_api}.py`, `tests/{test_download,test_queue_worker,test_universe_api}.py`
- `docs/guides/API.md`

## Build
1. `plan.py` `build_plan(db, request)`: steps = symbol × `plan_chunks`. Coverage per step from `candles`
   (distinct IST dates in range): covered when data starts ≤ 5 days after the step start, ends ≤ 5 days before
   its end, and no gap > 5 calendar days. `skip_existing` marks covered steps `skipped`. Estimates: rows =
   weekdays × bars/day (1m 375, 3m 125, 5m 75, 15m 25, 30m 13, 1h 7, 1d 1) for non-skipped steps; bytes = rows × 80;
   seconds from requests and pace (2/s, or 1/s for the part falling in market hours when mode is `slow`),
   + 20% margin; start = now + remaining seconds of queued/running/paused-ahead jobs. Warnings: > 20M rows,
   > 2 h, symbol not synced, range before Kite's 1m history (2015-01-01).
2. Endpoints under `/market-data/jobs`: `POST /plan` → 201 `draft` job with steps + plan (expires 24 h);
   `POST /{id}/start` (draft → queued; 400 if expired), `/pause` (queued|running → paused), `/resume`
   (paused → queued); cancel also accepts `draft`/`paused`. `GET|PUT /market-data/download-settings`.
   `GET /market-data/universe/sectors` → `[{sector, count}]` and `?sector=` on the universe list (bulk pick, 094).
   Each audited (D57 actions). Old `POST /jobs` stays until 094 merges (Relay still uses it): it plans with `skip_existing` and starts at once. The archive job is unchanged.
3. Worker: runs pending steps in `seq` order; after each step marks it `done` with rows, updates progress
   (= done+skipped / total) and commits; before each step re-reads status: `paused` → stop, `cancelled` → stop.
   On start, `running` jobs are requeued and continue from their first pending step. Pace: sleep between requests
   so the rate is ≤ 1/s on weekdays 09:15–15:30 IST when `market_hours_mode = slow`.
4. Drafts past `expires_at` are cancelled by the worker's idle loop.

## Acceptance checks
- [ ] pytest: plan for 3 symbols with one fully stored → its steps skipped; `overwrite` → none skipped; estimates exact for a fixed input.
- [ ] pytest: pause after step 2 → resume → finishes with no step run twice; kill worker mid-job → restart continues.
- [ ] pytest: slow mode at 10:00 IST paces to 1/s (fake clock); full mode doesn't.
- [ ] pytest: every endpoint success/400/404/audit; expired draft cannot start.
- [ ] Definition of done in `AGENTS.md` §9.

## Out of scope
- Screens (094). Parallel downloads. Changing broker limit rules.

## Questions

## Handoff

## Review
