# NOVA-035 — Backtest form: symbol picker with filters and data-coverage check

**Status:** done · **Owner:** Claude · **Branch:** main · **Depends on:** NOVA-031, NOVA-033

## Goal
The run form picks symbols from a searchable, filterable instrument list with a checkbox per row
(R2): index, sector, F&O-only filters; symbols without data for the period are flagged, and queueing
asks to drop them. Selected count always visible; at least one symbol, or a whole index.

## Files
Create: Orbit `components/InstrumentTable.tsx` (shared with NOVA-036), `pages/backtests/UniverseFields.tsx`.
Modify: Orbit `pages/backtests/{NewBacktestPage.tsx,backtestForm.ts,backtestForm.test.ts,backtests.test.tsx}`;
ui-core `DataTable/{DataTable.tsx,selectionColumn.tsx,DataTable.test.tsx}` (fix, see Handoff).

## Acceptance checks
- [x] Columns: symbol + name, sector, index, last close, day change, 52-week range, avg volume, F&O lot, data range.
- [x] "Partial data" badge when data does not cover From–To; queue opens "Drop and queue" dialog.
- [x] Default period = two months up to the latest data date (never after today).
- [x] "Test on: a whole index" skips the picker.

## Out of scope
- Server-side search, saving symbol baskets.

## Handoff
**Done:** Built by Claude directly on `main` (Gemini offline; Owner request 2026-09-23).
**Fix to NOVA-033:** the selection column was rebuilt on every selection change, so TanStack remounted
every checkbox (lost focus; a second click could hit a detached node). The column is now created once and
cells read selection from `SelectionContext`; regression test "keeps the same checkbox node and focus".
**Checked:** Orbit backtests + DataTable tests pass; typecheck and lint pass.

## Review
**Result:** done (self-built; no separate review).
