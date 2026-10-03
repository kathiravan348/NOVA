# NOVA-176 — Strategies page: search, more filters, results by data source (D82)

**Status:** ready-for-review · **Owner:** ChatGPT · **Branch:** task/NOVA-176 · **Depends on:** NOVA-170

## Goal
**Strategies** can be searched and filtered by status, mode, segment, timeframe, tested or not and minimum best
CAGR, and its cards can show results from **History data**, **Recorded data** or both.

## Read first
- `AGENTS.md` §6; `docs/DECISIONS.md` row D82 (10); `docs/COMPONENTS.md` (Input, Select, Switch, StrategyCard)
- `frontend/apps/nova-orbit/src/pages/strategies/StrategiesPage.tsx`; `useStrategyStats` in `services/src/queries/orbit.ts`

## Files
Create:
- `frontend/apps/nova-orbit/src/pages/strategies/StrategyFilters.tsx`, `strategyFilters.ts`, test `strategyFilters.test.ts`
- `frontend/apps/nova-orbit/src/pages/strategies/strategyPageFilters.test.tsx`
Modify:
- `frontend/apps/nova-orbit/src/pages/strategies/StrategiesPage.tsx` (+ its existing test)
- `docs/guides/USER-GUIDE.md` (Strategies page)

## Build
1. `strategyFilters.ts`: pure `filterStrategies(list, statsById, values)` and URL ⇄ values helpers, with tests.
   `sortStrategies` moves here and adds **Name (A–Z)**, **Best net P&L**, **Smallest drawdown**.
2. `StrategyFilters` (ui-core fields, props in, `onChange` out): always shown — **Search** (name, case-insensitive),
   **Status**, **Results from** (All data / History data / Recorded data → `useStrategyStats({ dataSource })`),
   **Sort by**. **More filters** (closed by default): **Mode** (Visual / Python / Rotation), **Segment**,
   **Timeframe** (incl. seconds), **Tested** (All / Tested / Not tested yet, from the chosen source's `runsCompleted`),
   **Min best CAGR %**. **Clear filters** when any is set. Values live in the URL.
3. Filtering is client-side (the strategies list is not paged). Empty result: "No strategies match" with
   **Clear filters**. Header shows "12 of 40 strategies".
4. Cards stay `StrategyCard`; the stats passed in come from the chosen source, so "Best CAGR" and the run counts
   follow **Results from**.

## Acceptance checks
- [x] Search "breakout" + Segment Intraday narrows the cards; the count line updates.
- [x] Results from Recorded data shows recorded-run stats; Tested + Recorded hides strategies never run on it.
- [x] Sort by Name orders A–Z; URL params restore the filters after reload.
- [x] Checked at 360px and desktop, dark and light; `pnpm review:check`.

## Out of scope
- Backend changes, tags or folders for strategies, the Library page.

## Questions
- Scope clarification (ChatGPT, planner): keep the new page-filter checks in `strategyPageFilters.test.tsx` so the existing integration test stays below 300 lines.

## Handoff
- Implementer: ChatGPT; implementation commit `321beef`.
- Added URL-backed search/status/source/sort and advanced latest-spec, tested and minimum-CAGR filters.
- Cards use statistics from the selected source; missing results sort last; empty matches offer Clear filters.
- Tests: 28 focused checks; final `pnpm review:check` passed (1,140 tests, lint/typecheck/format, both apps and Storybook).
- Check workers bounded to four forks/threads to avoid the existing approval-batch timing flake.
- Visual QA: 360px and 1440px, dark/light; fields and cards fit without page overflow.
- Guides: USER-GUIDE Strategies section; maps: none; dependencies: none.
- New integration checks were split into their own file to keep all touched files below 300 lines.
- Recorder, database and Redis start times unchanged; temporary task previews closed.
- Pending: independent review/merge. Stacked review order: 171 → 173 → 172 → 174 → 175 → 176.
