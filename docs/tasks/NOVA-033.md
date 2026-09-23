# NOVA-033 — DataTable: row selection + search box

**Status:** done · **Owner:** Claude · **Branch:** task/NOVA-033 · **Depends on:** NOVA-009

## Goal
`DataTable` can show a checkbox per row with controlled selection and a search box that filters
rows, on desktop and in mobile cards (D29). Used next by the symbol picker (NOVA-035).

## Read first
- `AGENTS.md` (§6, §8), `docs/DECISIONS.md` (D19, D29)
- `frontend/packages/ui-core/src/components/DataTable/*`
- `frontend/packages/ui-core/src/components/{Checkbox/Checkbox.tsx,Input/Input.tsx}`

## Files
Modify:
- `frontend/packages/ui-core/src/components/DataTable/{DataTable.tsx,DataTableCards.tsx,DataTable.stories.tsx,DataTable.test.tsx,storyData.ts}`
- `docs/COMPONENTS.md` (DataTable line)
Create (if `DataTable.tsx` would pass 300 lines):
- `frontend/packages/ui-core/src/components/DataTable/DataTableToolbar.tsx`

## Build
1. New optional props (all off by default; existing usage unchanged):
   `selectedIds?: string[]`, `onSelectedIdsChange?: (ids: string[]) => void` (selection on when both set;
   requires `getRowId`), `isRowSelectable?: (row) => boolean` (unselectable rows show a disabled checkbox),
   `search?: { label: string; placeholder?: string; getText: (row) => string }` (case-insensitive contains).
   `toolbar?: ReactNode` rendered next to the search box (apps put filter Selects there).
2. Selection column first: header checkbox = "Select all shown" (all filtered rows across pages,
   selectable only; indeterminate when partial); row checkbox `aria-label` "Select <row id>".
   Selection survives sorting, paging and search (ids not in the current data are kept).
3. Search uses TanStack `globalFilter`; resets to page 1. Show "N selected" (mono) in the toolbar
   when selection is on, and "No rows match" (the `emptyState`) when search hides everything.
4. Mobile cards: checkbox at the top-left of each card; whole card is not a click target.
5. Stories: Selectable, Selectable with search + toolbar, Some rows unselectable, Empty search result.
   Tests: select row, select all shown (only filtered, skips unselectable), indeterminate, search filter + reset page, cards view.

## Acceptance checks
- [ ] Keyboard: Tab reaches search, header and row checkboxes; Space toggles; focus visible.
- [ ] Stories at 360px and desktop, dark and light; existing DataTable stories/tests unchanged and passing.
- [ ] Definition of done in `AGENTS.md` §9.

## Out of scope
- Server-side filtering/pagination, column filters UI, shift-click ranges, any app change.

## Questions

## Handoff
**Done:** Built by Claude directly on `main` (Gemini offline; Owner request 2026-09-23).
**Files changed:** DataTable `{DataTable.tsx, DataTableCards.tsx, columnMeta.ts, DataTable.stories.tsx, DataTable.test.tsx, storyData.ts}`; new `DataTableToolbar.tsx`, `selectionColumn.tsx`; `Checkbox.tsx` (indeterminate shows a minus icon); `docs/COMPONENTS.md`.
**Deviations:** selection column split into `selectionColumn.tsx` to keep `DataTable.tsx` small; Checkbox gained the indeterminate icon (needed for "Select all shown").
**Checked:** DataTable + Checkbox tests (18) pass; ui-core lint/typecheck pass.

## Review
**Result:** done (self-built; no separate review).
**Follow-up tasks created:** none.
