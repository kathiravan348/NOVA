# NOVA-094 — Relay: plan review before Start, Pause/Resume, bulk pick by index/sector, pace setting

**Status:** done · **Owner:** Claude · **Branch:** task/NOVA-094 · **Depends on:** NOVA-088, NOVA-091, NOVA-093, NOVA-095

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
**Done:** New download = pick (Add index… / Add sector… / Clear) → **Check plan** → plan review (per stock, totals, warnings, Skip/Overwrite re-plans) → **Start**; Pause/Resume/Start on the job page, steps and plan card; Download pace card; recorder modal uses the bulk picker.
**Files changed:** as listed; plus `services/src/{api,queries}/downloads.ts` (new, keeps `relay.ts` small), `http.ts` (DELETE), `realtime.ts` (cache removal, 10 s handshake timeout), `mocks/src/handlers/downloads.ts` + test, `lib/plan.ts` + test, `downloads.test.tsx` (New download tests moved there).
**Commands run:** `pnpm review:check` → pass. Real stack: plan of 6 stocks (1 step already stored), Start, Pause at 2/12, worker restart, Resume → completed, 11 Kite requests for 11 steps.
**Checked:** 360px ✓ · desktop ✓ · dark ✓ · light ✓ (real mode); mock mode by tests.
**New dependencies:** none. **Guides updated:** USER-GUIDE.
**Deviations from task:** Skip/Overwrite and pace are `Select`s (no radio in ui-core; no new component needed). Chosen stocks show as the table selection plus a count, not chips. Bulk counts come from the loaded stock list, so `/universe/sectors` is not called. Back and re-plan delete the draft (NOVA-095) instead of leaving it to expire.
**Known gaps:** none.

## Review
**Result:** done (built and merged by Claude at the Owner's request).
**Fixed directly:** stuck "Connecting…" after a backend restart (Vite proxy hung the handshake) → client closes a handshake after 10 s and retries; "1 steps" wording.
**Guides checked:** USER-GUIDE matches. **Rulebook issues found:** none. **Follow-up tasks created:** none.
