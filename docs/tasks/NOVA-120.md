# NOVA-120 — Orbit results: year-by-year table, new metrics, tax, benchmark line (D62 (6))

**Status:** planned · **Owner:** — · **Branch:** task/NOVA-120 · **Depends on:** NOVA-114

## Goal
A backtest's page answers "did it make ₹2.5 L every year after tax?". It shows a **Year by year** table, the new metrics
(benchmark, time invested, days held, profit factor, Calmar, estimated tax, after-tax result) and the benchmark line on the
equity curve. The Versions table and Compare show the after-tax CAGR. Old runs show "—" for anything null. It works in mock
mode now; real numbers arrive with NOVA-116.

## Read first
- `AGENTS.md` §6–7; `docs/DECISIONS.md` D60, D62; every file under Files

## Files
Create:
- `frontend/apps/nova-orbit/src/pages/backtests/YearsTable.tsx`, `frontend/apps/nova-orbit/src/pages/backtests/years.test.tsx`
Modify:
- `frontend/apps/nova-orbit/src/pages/backtests/{MetricsGrid,BacktestResultPage,VersionsTable}.tsx`, `backtests.test.tsx`
- `frontend/apps/nova-orbit/src/pages/compare/{compareMetrics.ts,compareMetrics.test.ts}`
- `docs/guides/USER-GUIDE.md`

## Build
1. `MetricsGrid`: add a second row of cards:
   - **After-tax CAGR** (caption "Estimated tax {₹}"; for intraday runs "No tax estimate for intraday")
   - **Benchmark return** (caption "{index}, same period")
   - **Time invested**
   - **Avg days held**
   - **Profit factor**
   - **Calmar**

   A null value shows "—" with a short caption, never 0. Values come straight from the result: no maths in the screen.
2. `YearsTable.tsx` (card **Year by year**, under the metrics):
   - Columns: **Year** ("Year 1 · 1 Oct 2021 – 30 Sep 2022"), **Return**, **Profit**, **Max drawdown**, **Benchmark**.
   - `PnLText` colours; mono, right-aligned numbers; stacked cards at 360px (DataTable).
   - A year whose return is below the D62 pass mark (−5%) gets a `danger` badge "Below −5%".
   - Empty `years` → the table is hidden.
3. `BacktestResultPage`: pass the benchmark to `EquityCurve`, which already draws `benchmarkPaise`, with the legend
   "NIFTY 50". Show the year table on both the full and the slim (old version) views. Slim versions keep `years` (NOVA-116).
4. `VersionsTable`: add an **After-tax CAGR** column (hidden on mobile). `compareMetrics`: add rows for after-tax CAGR,
   benchmark return, profit factor and Calmar; nulls show "—".
5. Mocks already carry the fields (NOVA-114).
6. USER-GUIDE Orbit Step 6: explain each new number in one plain sentence each: after-tax CAGR is an estimate at today's tax
   rates, benchmark, time invested, profit factor, Calmar. Also how to read Year by year. Update "State as of".

## Acceptance checks
- [ ] Mock run: 5 year rows with the right labels; profits add up to the net P&L shown; the benchmark line and legend are visible.
- [ ] A mock run with null metrics and `years: []` shows "—" and no year card (test).
- [ ] Checked at 360px and desktop, dark and light; `pnpm review:check` passes.

## Out of scope
- Computing any number (backend, NOVA-116); a strategy leaderboard page; charts per year.

## Questions
_(implementer writes here if blocked)_

## Handoff
_(implementer, ≤ 20 lines — see `docs/templates/HANDOFF.md`)_

## Review
_(Claude, ≤ 20 lines — see `docs/templates/REVIEW.md`)_
