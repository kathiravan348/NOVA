# NOVA-172 — Compare: pick runs in a popup with filters (D82)

**Status:** planned · **Owner:** — · **Branch:** task/NOVA-172 · **Depends on:** NOVA-171, NOVA-173

## Goal
**Compare** no longer lists every run above the results. The chosen runs show as a short row at the top;
**Choose runs** opens a popup with the Backtests filters, so the comparison is visible without scrolling.

## Read first
- `AGENTS.md` §6; `docs/DECISIONS.md` row D82 (7); `docs/COMPONENTS.md` (Modal with `size`, Tabs, DataTable, Pager)
- `frontend/apps/nova-orbit/src/pages/compare/*`; `pages/backtests/{RunFilters.tsx,runFilters.ts}` (NOVA-171)

## Files
Create:
- `frontend/apps/nova-orbit/src/pages/compare/RunPickerDialog.tsx`, `SelectedRuns.tsx`, test `compare.test.tsx`
Modify:
- `frontend/apps/nova-orbit/src/pages/compare/ComparePage.tsx`
- `frontend/apps/nova-orbit/src/pages/backtests/RunFilters.tsx` (a `hideStatus` prop only)
Delete:
- `frontend/apps/nova-orbit/src/pages/compare/RunPicker.tsx` (and its test, if any)
Modify (guide):
- `docs/guides/USER-GUIDE.md` (Compare)

## Build
1. `SelectedRuns`: one compact chip per chosen run (name, version, data source, period) with a remove button,
   then **Choose runs** (opens the popup). With fewer than two runs, the empty state also has **Choose runs**.
2. `RunPickerDialog` (Modal `size="xl"`): Tabs **History data** / **Recorded data** (filter only — a selection
   may mix both, so a strategy's history and recorded runs can be compared), `RunFilters` without Status (always
   completed), a table with a checkbox per row and Name, Strategy, Period, Net P&L, CAGR, Max DD, Win rate, Trades,
   server paging (Pager). At most 3 selected: other boxes disable. Footer: "2 of 3 selected", **Cancel**, **Compare**.
   The draft selection is kept while the dialog is open and applied only on **Compare**.
3. Filters inside the dialog live in component state, not the page URL. The page URL keeps only `?runs=` as today.
4. `ComparePage` drops its own `useBacktests` list and Pager; it loads the chosen runs by id (`useBacktestRuns`)
   as today. Skipped-run note, metrics table and equity curves stay as they are.

## Acceptance checks
- [ ] Opening `/compare?runs=a,b` shows the comparison immediately, with two chips and no run list.
- [ ] In the dialog: filtering by Min CAGR narrows the table; choosing a history run and a recorded run, then
      **Compare**, updates the URL and the results; **Cancel** leaves the selection unchanged.
- [ ] A fourth checkbox is disabled when three are chosen.
- [ ] Checked at 360px (dialog fills the screen width) and desktop, dark and light; `pnpm review:check`.

## Out of scope
- More than 3 runs, new comparison metrics, backend changes.

## Questions

## Handoff
