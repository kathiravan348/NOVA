# NOVA-107 — Orbit: delete backtests, Edit as a new version, Versions table (D60)

**Status:** done · **Owner:** Claude · **Branch:** task/NOVA-107 · **Depends on:** NOVA-104

## Goal
From Orbit the Owner deletes one or many backtests, edits a backtest (which queues its next version), sees
every version's settings and numbers on the run page, and reads an old version as a summary.

## Read first
- `AGENTS.md`; `docs/DECISIONS.md` D60; `docs/CONTRACTS.md` (BacktestRun, BacktestVersion)
- `frontend/apps/nova-orbit/src/pages/backtests/{BacktestResultPage,BacktestsPage,NewBacktestPage,backtestForm,runColumns,backtests.test}.tsx|ts`
- `frontend/apps/nova-orbit/src/pages/compare/ComparePage.tsx`; `frontend/apps/nova-orbit/src/routes.tsx`
- ui-core `DataTable` (row selection, NOVA-033) and `Modal` props

## Files
Create:
- `frontend/apps/nova-orbit/src/pages/backtests/{DeleteBacktestButton,VersionsTable,EditBacktestPage}.tsx`
Modify:
- `frontend/apps/nova-orbit/src/pages/backtests/{BacktestResultPage,BacktestsPage,NewBacktestPage,backtestForm,runColumns,backtests.test}.tsx|ts`
- `frontend/apps/nova-orbit/src/pages/compare/ComparePage.tsx`, `frontend/apps/nova-orbit/src/routes.tsx`
- `docs/guides/USER-GUIDE.md`

## Build
1. Run page header: the name shows "· v2" when `version > 1`; buttons **Edit** (not while queued/running) and
   **Delete** (not while running). Delete opens a Modal: "Delete <name> and all its versions? This cannot be
   undone." → `useDeleteBacktest(id, "all")`, toast, back to **Backtests**.
2. `/backtests/:id/edit` (`EditBacktestPage`): the new-backtest form pre-filled from the run (strategy fixed and
   shown as text; version, stocks, period, capital, benchmark, name editable); **Queue new version** →
   `useAddBacktestVersion` → opens the new run. Share the form with `NewBacktestPage` (extract what is needed;
   `backtestForm.ts` gets `defaultsFromRun(run)`).
3. `VersionsTable` below the header when the backtest has more than one version: Version, Strategy version,
   Symbols, Period, Status, Net P&L, Return, Win rate, Max drawdown, Trades; the row of the page's own run is
   marked; each row links to its run; old versions have a Delete icon button (confirm, `scope=version`).
4. An old version (`reportKept = false`): metrics grid only, plus the note "Older version: only the summary is
   kept. The newest version has the full report." with a link to the newest; no equity curve, symbols or trades.
5. **Backtests** list: row selection; **Delete selected (n)** with a confirm Modal → `useDeleteBacktests`;
   the name cell shows "v3" for later versions. A running run's checkbox is disabled.
6. Compare: a run without a kept report shows its metrics and "No equity curve (older version)".
7. 360px: buttons wrap, the versions table stacks as cards. USER-GUIDE: delete, edit/versions, "what do I do if".

## Acceptance checks
- [ ] Vitest: delete from the run page (confirm, request, navigation); bulk delete of two selected runs; edit
      pre-fills from `run_002` and posts `BacktestVersionCreate`; `run_002` shows versions 2 and 1; `run_006`
      shows the summary note and no trades table; the list hides `run_006`.
- [ ] Checked at 360px and desktop, dark and light.
- [ ] Definition of done in `AGENTS.md` §9.

## Out of scope
- Backend (105). Strategy version pages (108). Cancelling a running run.

## Questions

## Handoff
Done. `DeleteBacktestButton.tsx` (run page Delete, per-version bin, `DeleteSelectedButton` for the list),
`VersionsTable.tsx`, `EditBacktestPage.tsx` (`/backtests/:id/edit`), `BacktestFormView` exported with `editing`
(strategy read-only, **Queue new version**), `defaultsFromRun`/`toVersionCreate`; run page header "· v2", Edit,
Delete, Versions table, summary-only view for older versions (no Compare button there); list tick boxes +
**Delete selected (n)** (running rows not selectable), "· v3" in names; Compare shows "No equity curve (older
version)" for an empty curve. USER-GUIDE Step 6 + §7.
- New tests in `versions.test.tsx` (kept `backtests.test.tsx` under 300 lines); `routes.test.tsx` now wraps the
  router in `ToastProvider` (the list page uses toasts).
- `useBacktest` also refreshes the versions table when a run finishes.
- Checked in a demo Orbit at 1280 px (dark) and 360 px (light): no side scroll, the Versions table stacks.
Guides: USER-GUIDE.

## Review
Built and reviewed by Claude. `pnpm review:check` passed. Merged.
