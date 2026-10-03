# NOVA-171 — Backtests page: History / Recorded tabs, result columns, filters (D82)

**Status:** in-progress · **Owner:** ChatGPT · **Branch:** task/NOVA-171 · **Depends on:** NOVA-169, NOVA-170

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
- `frontend/apps/nova-orbit/src/pages/backtests/{BacktestsPage,runColumns}.tsx`, tests `backtests.test.tsx`,
  `versions.test.tsx` (existing bulk-delete test follows the new source tabs)
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
Resolved by ChatGPT as planner, 3 Oct 2026: the full gate's existing bulk-delete test spans data sources.
Its fixture selection must follow History data; added that regression file to this task, with no feature change.

## Handoff
- Built by Claude (initial filters) and ChatGPT (completed 3 Oct 2026), continuing the paused branch.
- Added source tabs, canonical URL filters, server sorting, result columns, page/selection reset and empty copy.
- Clear filters removes sort/order too; invalid numbers are omitted. Explicit JSX import avoids Windows casing ambiguity.
- Changed: BacktestsPage, RunFilters, runFilters, runColumns, filter/page/version tests, USER-GUIDE.
- Checks: 35 focused tests; bulk-delete and approvals regression tests (14); full review:check green (1104 tests).
- Visual: 360px/1440px, dark/light, captured and inspected; no viewport overflow. Mock preview only.
- Guides: USER-GUIDE (list tabs, results, filters, sorting and URL persistence). Dependencies: none.
- Not merged: independent review required. Subsequent task branches may build on this verified branch.
