# NOVA-146 — ui-core Pager: total, page numbers, rows per page

**Status:** done · **Owner:** ChatGPT · **Branch:** task/NOVA-146 · **Depends on:** —

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
- `docs/{COMPONENTS.md,STRUCTURE.md}` (Pager entries), `docs/guides/USER-GUIDE.md` (table controls)
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
- [x] Pager renders the correct range and page count for 1,240 entries at sizes 25/50/100/200.
- [x] Existing DataTable tests pass; a table can change rows per page.
- [x] Stories checked at 360px and desktop, dark and light; a11y addon clean.
- [x] Definition of done in `AGENTS.md` §9.

## Out of scope
- Server `total`/`offset` in contracts and endpoints (NOVA-147), switching screens from Load more (NOVA-148).

## Questions
_(implementer writes here if blocked)_

## Handoff
**Done:** Controlled Pager and DataTable integration; size changes reset page 1, unset pageSize shows all rows without controls.
**Files changed:** ui-core/src/components/Pager/{Pager.tsx,Pager.test.tsx,Pager.stories.tsx}, DataTable/{DataTable.tsx,DataTablePagination.tsx,DataTable.test.tsx,DataTable.stories.tsx}, ui-core/src/index.ts; COMPONENTS.md, STRUCTURE.md, USER-GUIDE.md, BOARD.md, NOVA-146.md.
**Commands run:** focused Pager/table/Approvals tests (39 passed); pnpm review:check passed (format, lint, typecheck, tests, build).
**Checked:** 360px ✓ · desktop ✓ · dark ✓ · light ✓; all five Pager stories have zero a11y addon violations and ≥40px controls; table stories and browser jump/size reset verified.
**New dependencies:** none. **Maps updated:** COMPONENTS, STRUCTURE. **Guides updated:** USER-GUIDE (table controls).
**Deviations from task:** required maps/guide added to Files before implementation; existing range text preserved for caller compatibility.
**Known gaps:** none; independent review pending. NOVA-145 is on its separate branch; keep both board statuses when merging.

## Review
**Result:** done
**Reviewer / built by:** Claude / ChatGPT. **Self-review:** no.
**Fixed directly (review: commits):** `approvalBatch.test.tsx` — the 50-request test gets a 20 s timeout (its own `waitFor` already allowed 10 s, above the 5 s default); it failed twice in the full suite under load, passes alone in ~1.5 s on both branches.
**Change requests:** none.
**Guides checked:** match the diff.
**Rulebook issues found:** none.
**Follow-up tasks:** none. Note for NOVA-148: a `DataTable` with no `pageSize` now shows every loaded row with no pager (was 10 per page): Strategy detail tables, Accounts and Data jobs. That matches the task text.
**Commands run:** pnpm review:check passed (1004 tests, build).
