# NOVA-150 — Instrument sync: warning + Download required data

**Status:** in-progress · **Owner:** ChatGPT · **Branch:** task/NOVA-150 · **Depends on:** NOVA-149

## Goal
After a Sync with Kite, Relay warns about stocks newly added to an index or newly listed that have no stored history,
and **Download required data** opens a prefilled plan for them (D74 (7)).

## Read first
- `AGENTS.md`; `docs/DECISIONS.md` rows D56, D74
- `backend/services/atlas/src/nova_atlas/{sync_job.py,universe.py}`; `frontend/apps/nova-relay/src/pages/instruments/{SyncCard.tsx,InstrumentsPage.tsx}`
- `frontend/packages/contracts/src/` (data job contract)

## Files
Modify:
- `backend/services/atlas/src/nova_atlas/{sync_job.py,universe.py}` (+ tests): the finished sync job records `newSymbols` (newly listed) and `newIndexMembers` (stock, index) that have no candles
- Data job contract, Pydantic model, mock, handler, `schema/*.json`; `docs/CONTRACTS.md`
- `frontend/apps/nova-relay/src/pages/instruments/{SyncCard.tsx,instruments.test.tsx}`
- `docs/guides/{API.md,USER-GUIDE.md}`, `docs/tasks/{BOARD.md,NOVA-150.md}`
- A migration only if the result cannot live in the job's existing result data (then also `DATABASE.md`)

## Build
1. During sync, compare the stock list and index members before and after; keep stocks that are new and have no stored candles.
2. The job exposes that list; a completed sync with a non-empty list shows a warning card on **Instruments**:
   "12 stocks have no price history: …" (first 5 names, then "and 7 more").
3. **Download required data** opens the plan review prefilled with those stocks (history from 1 Jan 2020, D69, or their listing day).
4. The warning goes away once every listed stock has history; no manual dismiss.

## Acceptance checks
- [x] A sync that adds two stocks shows the warning; the button opens a plan with exactly those stocks.
- [x] A sync with nothing new shows no warning; backend tests cover both cases.
- [x] Definition of done in `AGENTS.md` §9 (`review:check` and `backend-check`).

## Out of scope
- Downloading without the Owner pressing Start; removed or delisted stocks.

## Questions
None.

## Handoff
**Done:** completed syncs persist new stocks/index members without candles; Relay warns and opens daily/minute plans, clearing the warning as history appears.
**Files changed:** `backend/libs/{nova_contracts,nova_db}/`, `backend/services/{atlas,core}/`, `frontend/apps/nova-relay/src/pages/instruments/`, `frontend/packages/{contracts,mocks}/`, `docs/CONTRACTS.md`, `docs/guides/{API,DATABASE,USER-GUIDE}.md`, `docs/tasks/{BOARD,NOVA-150}.md`.
**Commands run:** `schema:update`, targeted frontend/backend tests, `pnpm review:check`, `docker compose run --rm backend-check` — pass; backend 1,282 tests.
**Checked:** 360px ✓ · desktop (1440px) ✓ · dark ✓ · light ✓; two-stock plan review verified without Start.
**New dependencies:** none.
**Maps updated:** CONTRACTS; existing module/component maps still apply.
**Guides updated:** USER-GUIDE / API / DATABASE.
**Deviations from task:** migration 0024 adds nullable `sync_result` because existing summary/plan fields cannot store the typed result; Atlas HTTP and Core WebSocket serializers carry it consistently.
**Known gaps:** none; independent review pending. Migration tested on throwaway databases, not applied to the running application database.
**Test note:** first backend gate hit cancellation in existing agent WebSocket teardown; isolated test and complete rerun passed.

## Review
_(reviewer — see `docs/templates/REVIEW.md`)_
