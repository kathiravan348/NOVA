# NOVA-136 — Orbit shows the stocks an index backtest skipped (D68)

**Status:** planned · **Owner:** — · **Branch:** task/NOVA-136 · **Depends on:** NOVA-135

## Goal
A run page tells the user which index members were left out because they have no prices in the period, so a
NIFTY 100 result on 94 stocks is not mistaken for all 100 (D68 (2)).

## Read first
- `AGENTS.md`; `docs/DECISIONS.md` D68; `docs/COMPONENTS.md`; every file under Files

## Files
Modify:
- `frontend/apps/nova-orbit/src/pages/backtests/BacktestResultPage.tsx`, `backtests.test.tsx`
- `docs/guides/USER-GUIDE.md`

## Build
1. When `run.skippedSymbols` is not empty, the run page (completed, summary-only and running states) shows a
   one-line note under the run header, using an existing `@nova/ui-core` component (no new component):
   "Skipped N stocks with no prices in this period: HYUNDAI, TATACAP" (list sorted as given; more than 10 →
   the first 10 and "and N more").
2. Nothing shows for `[]`.
3. USER-GUIDE Step 5 (whole index: members listed after the start date are skipped and named on the run
   page; a member listed during the period joins from its first day) and Step 6 (the note). Row in "what do
   I do if": "My index run has fewer stocks than the index".

## Acceptance checks
- [ ] Test: the NIFTY 100 mock run shows the note with HYUNDAI and TATACAP; a run with `[]` shows none.
- [ ] Checked at 360px and desktop, dark and light.
- [ ] `pnpm review:check` passes.

## Out of scope
- Backend or contracts (NOVA-135); the New backtest form; the Backtests list and Compare pages.

## Questions
_(implementer writes here if blocked)_

## Handoff
_(implementer, ≤ 20 lines — see `docs/templates/HANDOFF.md`)_

## Review
_(reviewer — Claude or ChatGPT, ≤ 20 lines — see `docs/templates/REVIEW.md`)_
