# NOVA-096 — Relay: Delete job (with or without its candles) + clear the test downloads

**Status:** planned · **Owner:** — · **Branch:** task/NOVA-096 · **Depends on:** NOVA-094, NOVA-095

## Goal
A finished job can be deleted from its page, with a choice to also delete the candles it downloaded. The
Owner's test downloads of 26 Sep 2026 are removed with it (Owner choice: the 4 downloads and their candles go,
the stock-list sync stays).

## Read first
- `AGENTS.md`, `docs/guides/API.md` (`DELETE /data-jobs/{id}`)
- `frontend/apps/nova-relay/src/pages/data-jobs/{DataJobDetailPage,CancelJobButton,dataJobs.test}.tsx`
- `frontend/packages/services/src/{api/relay,queries/relay,realtime}.ts`, `frontend/packages/mocks/src/handlers/relay.ts`

## Files
Create:
- `frontend/apps/nova-relay/src/pages/data-jobs/DeleteJobButton.tsx`
Modify:
- `frontend/apps/nova-relay/src/pages/data-jobs/{DataJobDetailPage,dataJobs.test}.tsx`
- `frontend/packages/services/src/{api/relay,queries/relay,realtime,realtime.test}.ts`, `queries/queries.test.tsx`
- `frontend/packages/mocks/src/handlers/relay.ts`
- `docs/guides/USER-GUIDE.md`

## Build
1. `deleteDataJob(id, {candles})` + `useDeleteDataJob()`: on success remove the job from detail and list caches.
2. Realtime `data_job.deleted`: same cache removal.
3. `DeleteJobButton` on the job page for draft/completed/failed/cancelled: Modal "Delete this job?", Checkbox
   **Also delete the candles it downloaded** (downloads only; unticked by default; says it also removes candles
   other jobs stored for the same stocks, timeframe and dates), danger **Delete job**. After: toast
   ("Deleted, 91,723 candles removed"), back to Data jobs. Mock mode: demo toast, nothing changes.
4. After merge, on the Owner's stack: delete the 4 test downloads with their candles; the sync job stays.

## Acceptance checks
- [ ] Vitest: button only for finished jobs; checkbox only for downloads; delete calls the API with `candles`;
      job leaves list and cache; realtime delete removes it.
- [ ] 360px + desktop, dark + light.
- [ ] Owner stack: only the `instrument_sync` job remains; `candles` is empty.
- [ ] Definition of done in `AGENTS.md` §9.

## Out of scope
- Bulk delete from the list. Deleting ticks or archives.

## Questions

## Handoff

## Review
