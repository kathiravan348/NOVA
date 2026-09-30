# NOVA-153 — Relay Live: Config page; recorder card leaves Data jobs

**Status:** done · **Owner:** Claude · **Branch:** task/NOVA-153 · **Depends on:** NOVA-152

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
- [x] Switch and stock list work in mock mode and against the real endpoints (settings unchanged).
- [x] Data jobs page has no recorder card; tests updated, none deleted without a moved equivalent.
- [x] Sidebar Live group: Monitor, Recorded data, Config.
- [x] Definition of done in `AGENTS.md` §9.

## Out of scope
- New recorder settings; changing the recorder; the tick archive job (stays on Data jobs).

## Questions
_(implementer writes here if blocked)_

## Handoff
**Done:** **Live → Config** page (recording switch card + table of chosen stocks with search and Remove); recorder card and stock modal moved to `pages/live/`; Data jobs gets a **Tick archive** card (Archive old ticks stays there) with a link to Config; Overview and Live empty states link to Config.
**Files changed:** relay `pages/live/{ConfigPage,RecordedStocksTable,RecorderCard,RecorderSymbolsModal,config.test}`, `pages/data-jobs/{ArchiveCard,DataJobsPage,dataJobs.test}`, `pages/overview/RecorderWaiting.tsx`, routes, layout; STRUCTURE, USER-GUIDE.
**Commands run:** focused Relay tests (148 pass); `pnpm review:check` before ready-for-review.
**New dependencies:** none. **Guides updated:** USER-GUIDE (Step 7, 7b, table). API/DATABASE unchanged.
**Deviations from task:** the stock table lists only the chosen stocks (adding stays in the existing **Choose stocks** dialog with index/sector bulk add, not a second picker); no `/data-jobs#recorder` redirect (nothing linked to it); the card title is **Live recording** (was **Live prices**); the recorder tests moved with the card, none deleted.
**Known gaps:** none.

## Review
**Result:** done
**Reviewer / built by:** Claude / Claude. **Self-review:** yes (Owner allowed: the other agents are offline; diff re-read, checks re-run).
**Fixed directly (review: commits):** none.
**Change requests (if sent back):** none.
**Checked:** switch and Choose stocks behave as before (same hooks and endpoints, no backend change); recorder tests moved with the card and none deleted; Archive old ticks still works from Data jobs; the last stock cannot be removed (an empty list would record every stock); agent account cannot open Config; desktop view checked; `review:check` passed (1,058 tests).
**Guides checked:** USER-GUIDE matches (Steps 7, 7b, "what do I do if" table); API and DATABASE not affected.
**Rulebook issues found:** none.
**Follow-up tasks created:** none.
