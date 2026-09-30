# NOVA-146 — ui-core Pager: total, page numbers, rows per page

**Status:** planned · **Owner:** — · **Branch:** task/NOVA-146 · **Depends on:** —

## Goal
A shared **Pager** shows "Showing 1–50 of 1,240", page numbers, first/previous/next/last, jump to page and a
**Rows per page** choice (25/50/100/200) — the control the next tasks put under every long list (D74 (5)).
`DataTable`'s own pagination uses it.

## Read first
- `AGENTS.md`; `docs/DECISIONS.md` row D74
- `frontend/packages/ui-core/src/components/DataTable/DataTablePagination.tsx`, `.../LoadMore/LoadMore.tsx`

## Files
Create:
- `frontend/packages/ui-core/src/components/Pager/{Pager.tsx,Pager.test.tsx,Pager.stories.tsx}`
Modify:
- `frontend/packages/ui-core/src/index.ts` (export)
- `frontend/packages/ui-core/src/components/DataTable/{DataTablePagination.tsx,DataTable.tsx,DataTable.test.tsx,DataTable.stories.tsx}`
- `docs/tasks/{BOARD.md,NOVA-146.md}`

## Build
1. `Pager` props: `page` (1-based), `pageSize`, `total`, `onPageChange`, `onPageSizeChange`,
   `pageSizes` (default `[25, 50, 100, 200]`), `loading?`. Pure and controlled; no data fetching.
2. Shows: "Showing X–Y of N entries", "Page P of M", buttons First / Previous / Next / Last (aria-labels),
   a page-number input (Enter jumps; clamped to 1..M) and a **Rows per page** select. Changing the size returns
   to page 1. `total === 0`: "No entries", controls disabled.
3. Layout: one row on desktop, two stacked rows at 360px; touch targets ≥ 40px; theme tokens only.
4. `DataTablePagination` renders `Pager` (client-side pages, its `pageSize` state starts at the table's current
   default and is user-changeable). It shows whenever the table has rows, not only when `total > pageSize`
   (keep hidden for tables with `pageSize` unset).
5. Stories: middle page, first page, one page, empty, loading. Tests: numbers, jump, clamp, size change resets page.

## Acceptance checks
- [ ] Pager renders the correct range and page count for 1,240 entries at sizes 25/50/100/200.
- [ ] Existing DataTable tests pass; a table can change rows per page.
- [ ] Stories checked at 360px and desktop, dark and light; a11y addon clean.
- [ ] Definition of done in `AGENTS.md` §9.

## Out of scope
- Server `total`/`offset` in contracts and endpoints (NOVA-147), switching screens from Load more (NOVA-148).

## Questions
_(implementer writes here if blocked)_

## Handoff
_(implementer, ≤ 20 lines — see `docs/templates/HANDOFF.md`)_

## Review
_(reviewer — see `docs/templates/REVIEW.md`)_
