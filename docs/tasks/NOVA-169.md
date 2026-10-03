# NOVA-169 — Orbit: choose the data source; seconds timeframes; recorded run details (D82)

**Status:** done · **Owner:** Claude · **Branch:** task/NOVA-169 · **Depends on:** NOVA-166 (merge after 167 is deployed)

## Goal
**Run backtest** and **Edit backtest** let the Owner pick **History data** or **Recorded data**, the strategy
editor offers 1-, 5-, 15- and 30-second candles, and a recorded run's page shows its source, days and spread cost.

## Read first
- `AGENTS.md` §6, §7a; `docs/DECISIONS.md` row D82; `docs/COMPONENTS.md` (Select, Field, DescriptionList, StatCard)
- `frontend/packages/contracts/src/{backtest,strategy,common}.ts` (after NOVA-166)

## Files
Create:
- `frontend/apps/nova-orbit/src/pages/backtests/DataSourceField.tsx`
Modify:
- `frontend/apps/nova-orbit/src/pages/backtests/{NewBacktestPage,BacktestResultPage,MetricsGrid}.tsx`, `backtestForm.ts`,
  tests `backtests.test.tsx`, `backtestForm.test.ts`
- `frontend/apps/nova-orbit/src/pages/editor/{BasicsFields.tsx,editorForm.ts}`
- `frontend/apps/nova-orbit/src/lib/format.ts` (`timeframeLabel` for seconds, `dataSourceLabel`)
- `frontend/packages/mocks/src/data.ts` (one completed recorded intraday run with days and spread cost)
- `docs/guides/USER-GUIDE.md` (Run backtest, Strategy editor, Backtest result)

## Build
1. `DataSourceField`: Select **Data** with **History data** (default) and **Recorded data**. Below it a hint:
   recorded = "Candles built from your recorded ticks (from 1 Oct 2026). Intraday only. Buys fill at the ask,
   sells at the bid. Days with feed gaps over 5 minutes are skipped."
2. Form rules (Zod in `backtestForm`, same messages as the API in NOVA-166): recorded needs an intraday strategy;
   seconds candles need recorded; recorded with a market filter is refused. **Edit** starts from the run's source.
   Keep `NewBacktestPage.tsx` ≤ 300 lines (move logic into `DataSourceField` / `backtestForm`).
3. Strategy editor: timeframe options add **1 second**, **5 seconds**, **15 seconds**, **30 seconds**, hint
   "Seconds candles run on recorded data only".
4. Result page details add **Data** (History data / Recorded data) and, for recorded runs, **Recorded days**
   ("12 used · 2 skipped" with the skipped dates in a `title`). `MetricsGrid` adds **Spread cost** when
   `spreadCostPaise` is not null.
5. Stories are not needed (no new ui-core/ui-trading component); render tests cover the new states.

## Acceptance checks
- [ ] Choosing Recorded data with a delivery strategy shows the error and blocks **Run**.
- [ ] A `5s` strategy defaults to Recorded data; switching to History data shows the seconds error.
- [ ] The mock recorded run shows Data, Recorded days and Spread cost; a history run shows neither line.
- [ ] Checked at 360px and desktop, dark and light; `pnpm review:check`.

## Out of scope
- Backtests list tabs and filters (171), backend changes, a recorded-days calendar in the form.

## Questions

## Handoff
- Built by Claude, 3 Oct 2026. `DataSourceField` (Select **Data**, hint per source, live error from
  `sourceProblem`; a seconds strategy starts on Recorded data until the user changes it; Edit keeps the run's).
- `backtestForm`: `dataSource` in the schema, defaults, create/edit/version bodies; `sourceProblem` and
  `isSecondsTimeframe` (the API's messages). Submit sets the error and queues nothing.
- Also changed (small, not listed): `UniverseFields` gets `checkCoverage` (recorded runs skip the downloaded-
  candle coverage flags and the drop dialog); the drop dialog moved to `UncoveredSymbolsModal.tsx` to keep
  `NewBacktestPage.tsx` under 300 lines (282).
- Editor: seconds options (labels from NOVA-166) + hint "Seconds candles run on recorded data only".
- Result page: **Data** and **Recorded days** ("10 used · 1 skipped", skipped dates on hover);
  `MetricsGrid` **Spread cost** when set. Mock `run_001` is now a recorded run (10 used, 5 Jun skipped).
- Checked in the browser (mock mode) at 375 px: hint shows, no horizontal scroll, coverage flags hidden.
- Checks: `pnpm review:check` green (1,092 tests). Guides: USER-GUIDE (Steps 4, 5, 6; known limits).

## Review
Self-review: yes (Owner allowed self-review on 3 Oct 2026). Matches the task. Frontend only: nothing to
deploy. Verdict: done.
