# NOVA-009 — ui-core: DataTable (sort, paginate, stacked cards on mobile)

**Status:** planned · **Owner:** — · **Branch:** task/NOVA-009 · **Depends on:** NOVA-007

## Goal
`@nova/ui-core` exports a generic `DataTable<T>` built on TanStack Table: sortable columns, client-side pagination, loading/empty/error states, and stacked cards below 768px.

## Read first
- `AGENTS.md` (§6–8), `docs/DECISIONS.md` (D19), `docs/COMPONENTS.md`
- `frontend/packages/ui-core/{package.json,src/index.ts,src/lib/cn.ts}`
- `frontend/packages/ui-core/src/components/{Button/Button.tsx,IconButton/IconButton.tsx,Skeleton/Skeleton.tsx,Card/Card.tsx}`

## Files
Create in `frontend/packages/ui-core/src/components/DataTable/`:
- `DataTable.tsx`, `DataTableCards.tsx` (mobile list), `DataTablePagination.tsx`, `columnMeta.ts`
- `DataTable.stories.tsx`, `DataTable.test.tsx`, `storyData.ts` (generic sample rows for stories/tests)
Modify: `frontend/packages/ui-core/{package.json,src/index.ts}`, `frontend/pnpm-lock.yaml` (via `pnpm install`), `docs/COMPONENTS.md`

## Build
1. Deps: `@tanstack/react-table` 8.x (exact latest stable). Make sure `lucide-react` is in `dependencies` (move it from devDependencies if NOVA-008 has not).
2. `columnMeta.ts`: augment TanStack's `ColumnMeta` (`declare module "@tanstack/react-table"`) with `numeric?: boolean` (mono `text-number`, right-aligned cell and header), `mobileLabel?: string` (label in cards; default = header string), `hideOnMobile?: boolean`, `primary?: boolean` (card title on mobile).
3. `DataTable` props: `columns: ColumnDef<TData, TValue>[]` (shadcn pattern `DataTable<TData, TValue>`; stories type columns as `ColumnDef<Row>[]`; no `any`), `data: TData[]`, `caption: string` (visually hidden `<caption>`, also the list's `aria-label`), `getRowId?`, `pageSize?` (default 10), `initialSort?: SortingState`, `loading?`, `error?: ReactNode`, `emptyState?: ReactNode` (default text "No rows to show").
4. Desktop (≥ `md`): real `<table>` inside `overflow-x-auto`. Header `bg-bg-raised`, `text-label uppercase text-text-muted`. Rows divided by `border-border-default`, side padding `px-5`. Sortable headers are a `<button>` inside `<th>`; `<th>` gets `aria-sort`; icon `ArrowUp`/`ArrowDown`/`ArrowUpDown` (aria-hidden). Column opts out with `enableSorting: false`.
5. Mobile (< `md`): `DataTableCards` renders `<ul aria-label={caption}>`, one `<li>` card per row: the `primary` column as title, the other visible columns as a `<dl>` of label/value pairs (numeric values right-aligned mono). Uses the same sorted, paginated rows. Both views are in the DOM; CSS shows one (`hidden md:block` / `md:hidden`).
6. `DataTablePagination`: shown only when rows > pageSize. "Showing 11–20 of 48" (`text-body-sm text-text-muted`) and Previous/Next IconButtons (ChevronLeft/Right, `aria-label`), disabled at the ends. Sorting resets to page 1.
7. States: `loading` → 5 skeleton rows (table) / 3 skeleton cards; `error` → the node in place of the rows with `role="alert"`; no rows → `emptyState`. Header stays visible in all three.
8. Stories (`Core/DataTable`): Default (25 rows, generic data such as files: name, owner, type, size, updated), Sorted, Loading, Empty, Error, FewRows (no pagination). Nothing trading-related.
9. Tests: renders headers and first page, clicking a header sorts and sets `aria-sort`, Next/Previous change page and the "Showing" text, loading/empty/error states, numeric column cells are right-aligned, cards view shows `mobileLabel` labels.

## Acceptance checks
- [ ] At 360px the story shows cards, no horizontal page scroll. At desktop it shows the table.
- [ ] 0 a11y violations in both themes. Sort buttons and pager are keyboard usable with a visible focus ring.
- [ ] No hex in components. Each file ≤ 300 lines.
- [ ] Definition of done in `AGENTS.md` §9.

## Out of scope
- Server-side sort/paging, filtering, search, column resize/visibility, row selection, clickable rows, virtualisation.
- A "sort by" control on mobile (cards keep the current sort).
- Changes to existing components, tokens or theme files.

## Questions

## Handoff

## Review
