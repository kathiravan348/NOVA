# NOVA-094 — Relay: plan review before Start, Pause/Resume, bulk pick by index/sector, pace setting

**Status:** planned · **Owner:** — · **Branch:** task/NOVA-094 · **Depends on:** NOVA-088, NOVA-091, NOVA-093

## Goal
New download shows the plan (what is already stored, requests, rows, size, time, start) and waits for
**Start**. Jobs can be paused and resumed. Stocks can be picked in bulk by index or sector. The market-hours
pace is a setting on Data jobs (D57).

## Read first
- `AGENTS.md`, `docs/DECISIONS.md` D57, `docs/guides/API.md` (jobs + download settings)
- `frontend/apps/nova-relay/src/pages/data-jobs/*`
- `frontend/packages/services/src/{api,queries}/relay.ts`, `queries/{marketData,keys}.ts`
- `frontend/packages/mocks/src/handlers/*` (data-job handlers)

## Files
Create:
- `frontend/apps/nova-relay/src/pages/data-jobs/{PlanReview,BulkStockPicker,PaceSetting,PauseResumeButton}.tsx`
Modify:
- `frontend/apps/nova-relay/src/pages/data-jobs/{NewDownloadPage,DataJobDetailPage,DataJobsPage,RecorderSymbolsModal,CancelJobButton,dataJobs.test}.tsx`
- `frontend/packages/services/src/{api,queries}/relay.ts`, `queries/keys.ts`, `queries/queries.test.tsx`
- `frontend/packages/mocks/src/handlers/*` (plan/start/pause/resume/settings), `data.ts`
- `frontend/apps/nova-relay/src/lib/labels.ts` (statuses **Draft**, **Paused**; new audit actions)
- `docs/guides/USER-GUIDE.md`

## Build
1. `BulkStockPicker` (used by New download and the recorder modal): search + **Add index…** and **Add sector…**
   (each shows its stock count, adds all members; duplicates ignored), **Clear**, chosen chips with remove.
2. New download: form → **Check plan** (calls plan) → `PlanReview`: per-stock table (already stored from–to,
   steps to fetch), totals (requests, rows, ~size in MB/GB, ~time as "about 35 min", starts "now" or "after 2 jobs, ~10:40"),
   warnings, radio **Skip data already there** (default) / **Overwrite** (re-plans), buttons **Start** / **Back**.
   If every step is already stored: "Nothing to download" and no Start.
3. Job page + list: **Pause** (queued/running), **Resume** (paused), **Start** (draft), steps "812 of 3,500",
   plan totals, expiry for drafts. Paused/draft badges.
4. `PaceSetting` card on Data jobs: "In market hours (09:15–15:30)": **Slow down** / **Full pace**, audited.
5. Only `@nova/ui-core` / `@nova/ui-trading`; missing pieces get a story first.

## Acceptance checks
- [ ] Vitest: bulk add by index/sector; plan review numbers from the mock; mode switch re-plans; Start queues;
      Pause/Resume change status; nothing-to-download state; pace setting saves.
- [ ] 360px + desktop, dark + light; mock and real mode.
- [ ] Real stack: plan 5 stocks 1 year 1m, start, pause, restart the worker, resume → completes, no duplicate steps.
- [ ] Definition of done in `AGENTS.md` §9.

## Out of scope
- Orbit. Scheduling jobs for a later time. Parallel jobs.

## Questions

## Handoff

## Review
