# NOVA-018 — Orbit: compare backtest runs

**Status:** planned · **Owner:** - · **Branch:** task/NOVA-018 · **Depends on:** NOVA-017

## Goal
`/compare` lets the owner pick 2–3 completed backtest runs and see their metrics side by side and their equity curves together on one screen. The selection lives in the URL (`?runs=run_001,run_002`) so it can be shared. (Market data moved to NOVA-029.)

## Read first
- `AGENTS.md` (§6, §7)
- `frontend/packages/services/src/queries/{keys.ts,orbit.ts}`, `src/queries/queries.test.tsx`
- `frontend/packages/ui-core/src/components/{Checkbox,DataTable}/*.tsx`
- `frontend/apps/nova-orbit/src/{routes.tsx,lib/format.ts,components/QueryState.tsx,test/renderApp.tsx}`, `src/pages/backtests/{MetricsGrid.tsx,BacktestResultPage.tsx}`

## Files
Create:
- orbit `src/pages/compare/{ComparePage.tsx,RunPicker.tsx,MetricsComparison.tsx,compareMetrics.ts,compareMetrics.test.ts,compare.test.tsx}`
Modify: services `src/queries/orbit.ts`, `src/queries/queries.test.tsx`; orbit `src/routes.tsx`, `src/pages/backtests/BacktestResultPage.tsx`

## Build
1. services: `useBacktestResults(ids: string[])` with `useQueries` (same keys/fns as `useBacktestResult`), returns the array of query results. Test: two ids resolve to their mocks.
2. `compareMetrics.ts`: `METRIC_ROWS`: ordered `{ key, label, format(m), better: "higher" | "lower" | null }` for Net P&L, Return %, CAGR %, Max drawdown, Sharpe, Win rate, Trades, Charges (formatting via ui-trading `formatInr`/`formatPercent`, explicit signs). `parseRunIds(search)` → unique ids, max 3; `toSearch(ids)`. `bestRunId(row, results)` → id of the best value (ties → none). Tests for parsing (dupes, >3, empty) and best-value picking (higher/lower/ties).
3. `RunPicker`: `Card` "Runs to compare": one `Checkbox` per completed run (label: run name + period); unchecked boxes disabled once 3 are chosen; helper text "Choose 2 or 3 runs". Loading skeleton / `QueryError`.
4. `MetricsComparison`: `DataTable` with one row per metric and one column per run (header = run name); the best value gets a `Badge` "Best" next to it (not colour alone). Mobile: stacked cards (DataTable default).
5. Equity: a responsive grid (1 col, 2 from `lg`) of `Card`s each with the run name and its `EquityCurve` (height 220).
6. `ComparePage`: reads/writes `?runs=` with `useSearchParams` (replace, no history spam). Fewer than 2 chosen → `EmptyState` "Choose at least two runs". Runs that are not completed or unknown are ignored with a small note.
7. `BacktestResultPage` (completed runs): "Compare" link → `/compare?runs=<id>`.
8. Tests (`renderApp`): `/compare` shows the picker and the empty state; checking two runs updates the URL and shows both names in the table with one "Best" per row where values differ; `/compare?runs=run_001,run_002` renders directly; `?runs=run_003` (running) is ignored with the note.

## Acceptance checks
- [ ] Works at 360px (picker, stacked metric cards, one chart per row) and desktop; dark/light; no colour-only meaning.
- [ ] Definition of done in `AGENTS.md` §9.

## Out of scope
- Overlaying curves in one chart, normalising to %, comparing more than 3 runs, market data (029).

## Questions

## Handoff

## Review
