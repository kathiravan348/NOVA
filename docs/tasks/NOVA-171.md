# NOVA-171 — Backtests page: History / Recorded tabs, result columns, filters (D82)

**Status:** in-progress · **Owner:** Claude · **Branch:** task/NOVA-171 · **Depends on:** NOVA-169, NOVA-170

## Goal
**Backtests** has two tabs, **History data** and **Recorded data**. The table shows each run's results, and a
filter bar narrows and sorts runs by name, strategy, status, segment, timeframe and result values.

## Read first
- `AGENTS.md` §6; `docs/DECISIONS.md` row D82 (6); `docs/COMPONENTS.md` (Tabs, DataTable, Pager, Select, Input, Switch)
- `frontend/apps/nova-orbit/src/pages/backtests/{BacktestsPage.tsx,runColumns.tsx}`; `services/src/queries/orbit.ts`

## Files
Create:
- `frontend/apps/nova-orbit/src/pages/backtests/RunFilters.tsx`, `runFilters.ts`, test `runFilters.test.ts`
Modify:
- `frontend/apps/nova-orbit/src/pages/backtests/{BacktestsPage,runColumns}.tsx`, test `backtests.test.tsx`
- `frontend/apps/nova-orbit/src/pages/strategies/StrategyDetailPage.tsx` (only if `useRunColumns` options change)
- `docs/guides/USER-GUIDE.md` (Backtests page)

## Build
1. `runFilters.ts`: `RunFilterValues` ⇄ URL search params ⇄ `BacktestFilter` (NOVA-170), pure functions with tests.
   Unknown or bad params are dropped. Changing a filter resets to page 1.
2. `RunFilters` (composition of ui-core fields; props in, `onChange` out, no API calls): always shown — **Search**
   (name), **Strategy**, **Status**, **Sort by** (Newest, Net P&L, Return, CAGR, Max drawdown, Win rate, Profit
   factor, Sharpe, Trades) + **Ascending** switch. **More filters** (closed by default, open when one is set):
   **Segment**, **Timeframe**, **Only profitable**, **Min return %**, **Min CAGR %**, **Max drawdown %**,
   **Min win rate %**, **Min trades**, **Min profit factor**. **Clear filters** when any is set. Numbers use the
   number input, ≥ 0 where it makes sense.
3. `BacktestsPage`: ui-core `Tabs` **History data** / **Recorded data** (`?source=`, default history), each tab
   keeps the same filters; the tab sets `dataSource`. Empty tab text: "No recorded-data backtests yet. Choose
   Recorded data when you run a backtest." Delete selected, Pager and **Run backtest** stay.
4. Columns (from `summary`, "—" when null): Name, Strategy, Symbols, Status, Period, **Net P&L** (PnLText),
   **Return**, **CAGR**, **Max DD**, **Win rate**, **Trades**, **Profit factor**, Created. Recorded tab adds
   **Spread cost**. Columns set `enableSorting: false`: sorting is the server's, through **Sort by** (a page of
   rows sorted locally would mislead).
   Mobile cards show Name, Status, Net P&L, CAGR, Max DD; the rest hide on mobile.

## Acceptance checks
- [ ] URL `?source=recorded&minCagr=10&sort=cagr` opens the Recorded tab with those filters and sends them.
- [ ] Clear filters empties the URL params except `source`; changing a filter returns to page 1.
- [ ] Mock mode: filtering by Min win rate removes the runs below it; Only profitable hides losing runs.
- [ ] Checked at 360px and desktop, dark and light; `pnpm review:check`.

## Out of scope
- Compare popup (172), strategies page (176), saved filter sets, column chooser, backend changes.

## Questions

## Handoff
- Paused by Claude, 3 Oct 2026 (usage limit). Done on this branch, not yet checked: `runFilters.ts`
  (URL ⇄ values ⇄ `BacktestFilter`) and `RunFilters.tsx` (filter bar, More filters, Clear, 400 ms typing delay).
- Left: wire `BacktestsPage` (Tabs by `?source=`, filters in the URL, page reset), result columns in
  `runColumns.tsx` (typed `BacktestRunListItem`, `enableSorting: false` when sorting is the server's),
  `runFilters.test.ts`, page tests, USER-GUIDE, `pnpm review:check`, then merge.
