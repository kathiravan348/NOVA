# NOVA-153 — Relay Live: Config page; recorder card leaves Data jobs

**Status:** planned · **Owner:** — · **Branch:** task/NOVA-153 · **Depends on:** NOVA-152

## Goal
**Live → Config** holds the recorder switch and the list of stocks to record. The recorder card and its stock
modal move out of Data jobs (D74 (3)).

## Read first
- `AGENTS.md`; `docs/DECISIONS.md` rows D54, D74
- `frontend/apps/nova-relay/src/pages/data-jobs/{RecorderCard.tsx,RecorderSymbolsModal.tsx,DataJobsPage.tsx,dataJobs.test.tsx}`
- `frontend/apps/nova-relay/src/pages/overview/RecorderWaiting.tsx`, `backend/services/broker/src/nova_broker/recorder_settings.py`

## Files
Create:
- `frontend/apps/nova-relay/src/pages/live/{ConfigPage.tsx,RecordedStocksTable.tsx,config.test.tsx}`
Modify:
- `frontend/apps/nova-relay/src/pages/data-jobs/{DataJobsPage.tsx,dataJobs.test.tsx}` (recorder card removed; tick recording jobs still listed)
- `frontend/apps/nova-relay/src/pages/live/{RecordedDataPage.tsx}`, `.../overview/*` (links to Config), `routes.tsx`, `layout/AppLayout.tsx` (+ tests)
- Move (git mv) `RecorderCard.tsx`, `RecorderSymbolsModal.tsx` into `pages/live/`
- `docs/guides/USER-GUIDE.md`, `docs/tasks/{BOARD.md,NOVA-153.md}`

## Build
1. **Config** page: the on/off **Record ticks** switch (same setting and endpoint as today), status (recording / waiting for login / off),
   and the stock list: table with search, index bulk add (reuse `BulkStockPicker`), remove, Pager; up to 500 stocks (Kite limit, D49).
2. Data jobs no longer shows the recorder card; a note "Recording lives under Live → Config" links there. Recording jobs still appear in the job list.
3. Overview and Recorded data empty states link to Config. Old deep links (`/data-jobs#recorder`) redirect.
4. Behaviour of the setting is unchanged: no backend change.

## Acceptance checks
- [ ] Switch and stock list work in mock mode and against the real endpoints (settings unchanged).
- [ ] Data jobs page has no recorder card; tests updated, none deleted without a moved equivalent.
- [ ] Sidebar Live group: Monitor, Recorded data, Config.
- [ ] Definition of done in `AGENTS.md` §9.

## Out of scope
- New recorder settings; changing the recorder; the tick archive job (stays on Data jobs).

## Questions
_(implementer writes here if blocked)_

## Handoff
_(implementer, ≤ 20 lines — see `docs/templates/HANDOFF.md`)_

## Review
_(reviewer — see `docs/templates/REVIEW.md`)_
