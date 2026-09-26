# NOVA-088 — Relay: Instruments for ~2,500 stocks (search, index filter, New listings, sync job)

**Status:** done · **Owner:** Claude · **Branch:** task/NOVA-088 · **Depends on:** NOVA-087

## Goal
The Instruments page handles the whole NSE list: search, filter by any index, a **New listings** view for
IPOs, the last sync time, and **Sync with Kite** that queues a job and shows its progress (D56).

## Read first
- `AGENTS.md`, `docs/DECISIONS.md` D56, `docs/guides/API.md` (market-data section)
- `frontend/apps/nova-relay/src/pages/instruments/*`
- `frontend/packages/services/src/{api,queries}/marketData.ts`, `queries/keys.ts`, `queries/relay.ts` (paged list pattern)
- `frontend/packages/mocks/src/handlers/marketData.ts`
- `frontend/apps/nova-relay/src/lib/labels.ts`, `pages/data-jobs/{DataJobDetailPage,DataJobsPage}.tsx`

## Files
Create:
- `frontend/apps/nova-relay/src/pages/instruments/SyncCard.tsx`
Modify:
- `frontend/apps/nova-relay/src/pages/instruments/{InstrumentsPage,UniverseEntryModal,instruments.test}.tsx`
- `frontend/packages/services/src/api/marketData.ts`, `queries/{marketData,keys,queries.test}.ts(x)`
- `frontend/packages/mocks/src/handlers/marketData.ts`, `handlers/marketData.test.ts`, `data.ts`
- `frontend/apps/nova-relay/src/lib/labels.ts` (job type **Instrument sync**, audit **Cleared new listing**)
- `frontend/apps/nova-relay/src/pages/data-jobs/{DataJobDetailPage,DataJobsPage,dataJobs.test}.tsx` (sync job: no period/timeframe rows; show `summary`)
- `docs/guides/USER-GUIDE.md`, `docs/COMPONENTS.md` if a shared component is added

## Build
1. Services: paged universe query with `q`, `index`, `new`; `useMarketIndices`; `useSyncInstruments` returns the job;
   `useClearNewListing`. Mocks: ~60 rows incl. 2 `newListing`, 19 indices, sync returns a queued job.
2. Page: search box (debounced 300 ms), **Index** select (All + every index with member count),
   tabs **All stocks** / **New listings (n)**. Table keeps paging ("Load more"), stacked cards at 360px.
   New-listing rows show a **New** badge and a **Mark as seen** action.
3. `SyncCard`: "Last synced <IST time> · <summary>" from the latest completed `instrument_sync` job;
   **Sync with Kite** → queues, shows the job's status + progress (polls like NOVA-084), link **View job**.
   Text: "Syncs automatically every weekday from 08:45 once Kite is logged in."
4. `UniverseEntryModal`: index choices from `useMarketIndices` (multi-select, searchable).
5. Only existing `@nova/ui-core` / `@nova/ui-trading` components; if one is missing, add it with a story.

## Acceptance checks
- [ ] Vitest: search, index filter, New listings tab, Mark as seen, sync queues and shows progress, error states.
- [ ] Data jobs: an `instrument_sync` job renders on list and detail with its summary.
- [ ] Checked at 360px and desktop, dark and light, in mock and real mode.
- [ ] Definition of done in `AGENTS.md` §9.

## Out of scope
- Orbit screens (089). Index price charts. Bulk edit.

## Questions

## Handoff
Built by Claude at the Owner's request. All acceptance checks pass.
- `SyncCard` (latest sync via new `useLatestSync` → `GET /data-jobs?type=instrument_sync&limit=1`, polls
  while active, refreshes universe/indices/instruments when it completes). Page: Tabs **All stocks** /
  **New listings (n)**, **Index** select (counts), search, **New** badge + **Mark as seen**. Edit dialog
  offers all indices from the API (keeps names no longer listed).
- Changes from the task text: filtering stays client-side (087 kept the list whole); **Load more** not
  needed (DataTable pages 25 at a time). Backend: `GET /data-jobs` gained `type` (+ test).
- Mocks: 2 demo new listings, 19 indices, a completed demo sync job, clear-new handler, jobs `type` filter.
- Also fixed: flaky `broker.test.tsx` passphrase test (waits for the dialog to close).
- Checked in the browser (mock mode): desktop dark + light, 375px stacked cards.
- Checks: `pnpm review:check` green; backend gate green. Guides: USER-GUIDE, API.

## Review
Self-reviewed.
