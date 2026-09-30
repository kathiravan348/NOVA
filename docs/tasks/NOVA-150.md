# NOVA-150 — Instrument sync: warning + Download required data

**Status:** planned · **Owner:** — · **Branch:** task/NOVA-150 · **Depends on:** NOVA-149

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
- [ ] A sync that adds two stocks shows the warning; the button opens a plan with exactly those stocks.
- [ ] A sync with nothing new shows no warning; backend tests cover both cases.
- [ ] Definition of done in `AGENTS.md` §9 (`review:check` and `backend-check`).

## Out of scope
- Downloading without the Owner pressing Start; removed or delisted stocks.

## Questions
_(implementer writes here if blocked)_

## Handoff
_(implementer, ≤ 20 lines — see `docs/templates/HANDOFF.md`)_

## Review
_(reviewer — see `docs/templates/REVIEW.md`)_
