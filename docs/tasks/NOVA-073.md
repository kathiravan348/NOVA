# NOVA-073 — Relay: new download page + real Cancel job

**Status:** planned · **Owner:** — · **Branch:** task/NOVA-073 · **Depends on:** NOVA-072, NOVA-074

## Goal
The super-admin queues a historical download from Relay (**New download** → pick stocks, timeframe, period)
and cancels a queued or running job from its detail page, instead of Docker commands (D54).

## Read first
- `AGENTS.md`, `docs/DECISIONS.md` D54, `docs/tasks/NOVA-072.md` and `NOVA-074.md` (endpoints)
- `frontend/apps/nova-orbit/src/pages/backtests/{NewBacktestPage,UniverseFields}.tsx` (period + symbol picker pattern)
- `frontend/apps/nova-relay/src/pages/accounts/AddAccountModal.tsx` (mutation, toast, demo text)

## Files
Create:
- `frontend/apps/nova-relay/src/pages/data-jobs/NewDownloadPage.tsx`
Modify:
- `frontend/packages/services/src/api/{relay,marketData}.ts`, `src/queries/{relay,marketData,keys}.ts`, `src/queries/queries.test.tsx`
- `frontend/packages/mocks/src/handlers/{relay,marketData}.ts`
- `frontend/apps/nova-relay/src/pages/data-jobs/{DataJobsPage,DataJobDetailPage,dataJobs.test}.tsx`, `src/routes.tsx`
- `docs/guides/USER-GUIDE.md`

## Build
1. Services: `createDataJob(body)`, `cancelDataJob(id)`, `listUniverse()`; hooks `useCreateDataJob`,
   `useCancelDataJob` (both refresh the data-jobs list and that job), `useUniverse`.
2. MSW: `POST /data-jobs` validates `DataJobCreate`, 400 for a symbol not in the mock instruments, answers
   201 with a `queued` job (not stored, like NOVA-070); `POST /data-jobs/:id/cancel` → the job as `cancelled`
   or 400 when finished; `GET /market-data/universe` built from the mock instruments.
3. `DataJobsPage`: **New download** button (toolbar and empty state) → `/data-jobs/new`. Replace the
   "This list is demo data" line with it (the DemoBanner already covers mock mode).
4. `NewDownloadPage`: stock table with search and select-all (DataTable selection), **Timeframe** select
   (1 minute … 1 day), **From** / **To** dates (default: last 365 days), **Segment** select (default
   Equity delivery). Hint under the timeframe: "1-minute data is large; start with a few stocks."
   Client checks = the contract's. **Queue download** → toast **Download queued**, go to the job's page
   (real mode) or the list (mock mode). Server errors in an alert.
5. `DataJobDetailPage`: **Cancel job** asks "Cancel this job? Rows already saved stay." then calls the API;
   toast **Job cancelled**. Remove the "Demo only" toast.
6. User guide: Step 7 (how to start a download and cancel), remove the "started from the command line" and
   "Cancel is a demo" lines from "not there yet".

## Acceptance checks
- [ ] Vitest: button opens the page; no stock selected or From after To blocks submit; success shows the toast;
      a server 400 shows its message; Cancel asks first and then shows **Job cancelled**.
- [ ] Page works at 360px (table becomes cards) in dark and light.
- [ ] Definition of done in `AGENTS.md` §9.

## Out of scope
- Editing the stock list, **Sync** (075); tick recording and archive (077). Scheduled or repeating downloads.

## Questions

## Handoff

## Review
