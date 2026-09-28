# NOVA-136 — Orbit shows the stocks an index backtest skipped (D68)

**Status:** done · **Owner:** Claude · **Branch:** task/NOVA-136 · **Depends on:** NOVA-135

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
- [x] Test: the NIFTY 100 mock run shows the note with HYUNDAI and TATACAP; a run with `[]` shows none.
- [x] Checked at 360px and desktop, dark and light.
- [x] `pnpm review:check` passes.

## Out of scope
- Backend or contracts (NOVA-135); the New backtest form; the Backtests list and Compare pages.

## Questions
_(implementer writes here if blocked)_

## Handoff
**Done:** Run pages show skipped stocks beneath the header using the existing Card component.
Lists preserve API order; over 10 names show the first 10 and the remaining count; empty lists hide it.
**Files changed:** frontend/apps/nova-orbit/src/pages/backtests/BacktestResultPage.tsx;
frontend/apps/nova-orbit/src/pages/backtests/backtests.test.tsx; docs/guides/USER-GUIDE.md;
docs/tasks/BOARD.md; docs/tasks/NOVA-136.md.
**Commands run:** Targeted backtest tests (19 passed); frontend review:check (format, lint, typecheck,
961 tests, app and Storybook builds): pass. Backend gate: N/A (frontend-only task).
**Checked:** 360px ✓; 1440px desktop ✓; dark ✓; light ✓, on the NIFTY 100 summary-only mock run.
Regression tests also cover completed/running states, no skipped stocks, and 12 skipped stocks.
**New dependencies:** none. **Maps updated:** none (existing component, no new routes or contracts).
**Guides updated:** USER-GUIDE, Steps 5–6 and troubleshooting row.
**Deviations from task:** Guide clarifies that shares listed during the period join from their first
prices; shares with no prices anywhere in the period are skipped, matching the engine.
**Known gaps:** none. Temporary preview stopped and browser viewport restored.

## Review
**Result:** done
**Reviewer / built by:** Claude / ChatGPT. **Self-review:** no.
**Fixed directly (review: commits):**
- One skipped stock read "Skipped 1 stocks"; now "Skipped 1 stock" (test added).
- Long inline template string moved into a small `skippedNote` helper with a named limit of 10.
**Change requests:** none.
**Guides checked:** USER-GUIDE Steps 5–6 and the troubleshooting row match the diff.
**Rulebook issues found:** none.
**Follow-up tasks created:** none.
**Checks:** `pnpm review:check` pass (962 tests, builds).
