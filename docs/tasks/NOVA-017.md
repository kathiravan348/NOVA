# NOVA-017 — Orbit: run-backtest form + backtest results screen

**Status:** planned · **Owner:** - · **Branch:** task/NOVA-017 · **Depends on:** NOVA-012, NOVA-014

## Goal
`/backtests` lists runs; `/backtests/new` is a form to configure a run (demo submit only); `/backtests/:id` shows a run: status, metrics, equity curve vs NIFTY 50, and trades with per-trade charges.

## Read first
- `AGENTS.md` (§6, §7), `docs/DECISIONS.md` (D17, D20)
- `frontend/packages/contracts/src/{backtest.ts,trade.ts,charges.ts}`, `frontend/packages/mocks/data/{backtestRuns,backtestResults,trades}.json`
- `frontend/packages/ui-trading/src/index.ts` (PnLCard, PnLText, PriceText, ChargesBreakdown, EquityCurve)
- `frontend/packages/ui-core/src/components/{StatCard,Modal,DateTimePicker,Switch}/*.tsx`
- `frontend/apps/nova-orbit/src/{routes.tsx,lib/format.ts,components/QueryState.tsx,test/renderApp.tsx,pages/strategies/*}`

## Files
Create in `frontend/apps/nova-orbit/src/pages/backtests/`:
- `BacktestsPage.tsx`, `NewBacktestPage.tsx`, `backtestForm.ts`, `backtestForm.test.ts`
- `BacktestResultPage.tsx`, `MetricsGrid.tsx`, `TradesTable.tsx`, `backtests.test.tsx`
Modify: orbit `src/routes.tsx`, `src/lib/format.ts`, `src/pages/strategies/StrategyDetailPage.tsx`

## Build
1. `format.ts`: `runStatusLabel` / `runStatusTone` (queued→neutral, running→info, completed→success, failed→danger); `formatPeriod(from, to)` → `1 Jun – 15 Jun 2026` (calendar dates, no zone shift).
2. `BacktestsPage`: header button "Run backtest" → `/backtests/new`. `DataTable` "Backtests": Name (link, primary), Strategy (name from `useStrategies`, link) + `v2`, Status badge, Period, Capital (`formatInr` 0 decimals, numeric), Created (IST, numeric; initial sort desc). Loading / error (`QueryError`) / empty states.
3. `backtestForm.ts`: Zod schema `{ strategyId, version, name, from, to, capitalRupees, benchmark: boolean }`: all required; `from ≤ to`; `to` not after today; capital ≥ ₹10,000; returns field messages. `defaultsFor(strategy?)` (latest version, name "<strategy> backtest", last 3 months, ₹10,00,000, benchmark on). Tests for each rule.
4. `NewBacktestPage`: RHF + `zodResolver`. `?strategy=` preselects. Strategy `Select` (non-archived strategies), Version `Select` (that strategy's versions, newest first, resets when strategy changes), Name `Input`, From/To `DateTimePicker mode="date"` via `Controller`, Capital `Input` (₹), Benchmark `Switch` "Compare with NIFTY 50". Submit → toast "Backtest queued (demo)" + description "Nothing runs in Stage A." and navigate to `/backtests`.
5. `BacktestResultPage` (`useBacktest(id)` via `QueryState`): header `Card` (name, status badge, strategy link + version, `DescriptionList`: period, capital, benchmark, created/finished IST). Then by status: queued/running → `EmptyState` "This run hasn't finished"; failed → `EmptyState tone="error"` with `run.error`; completed → `useBacktestResult` + `useBacktestTrades`.
6. `MetricsGrid`: responsive grid (2 cols → 4 from `lg`): `PnLCard` Net P&L (with `returnPercent`), `PnLCard` Gross P&L, `StatCard`s Charges, CAGR, Max drawdown, Sharpe, Win rate (`3 of 4`), Trades. Values from `metrics` only; no client-side sums.
7. Equity: `Card` "Equity curve" with `EquityCurve` (`initialCapitalPaise` from the run).
8. `TradesTable`: `DataTable` "Trades": Symbol (primary), Side, Qty, Entry (IST time + `PriceText`), Exit (or "Open"), Gross (`PnLText`), Charges (`formatInr`), Net (`PnLText`), and a "Charges" ghost button opening a `Modal` with `ChargesBreakdown` for that trade. Numbers numeric/right-aligned.
9. Strategy detail header gets "Run backtest" (`/backtests/new?strategy=<id>`).
10. Tests (`renderApp`): list shows 5 runs with statuses; `run_001` shows net P&L, equity curve summary text and 2 trades; charges modal opens; `run_003` shows not-finished state; `run_005` shows its error; unknown id → Not found; form: preselected strategy from query, `from > to` error, valid submit → toast + back on `/backtests`.

## Acceptance checks
- [ ] All three pages at 360px (cards, stacked metrics, chart fits) and desktop; dark/light; money with Indian grouping and explicit signs.
- [ ] Definition of done in `AGENTS.md` §9.

## Out of scope
- Starting runs, polling status, POST handlers, comparing runs (018), CSV export, drawdown chart.

## Questions

## Handoff

## Review
