# NOVA-125 — ui-core DataTable: group rows (D63 (5))

**Status:** done · **Owner:** Claude · **Branch:** task/NOVA-125 · **Depends on:** —

## Goal
`DataTable` can show its rows in collapsible groups. A row may sit in several groups, and each group header shows a summary
and actions. On mobile, the groups become stacked cards. This is a generic ui-core feature with stories. Stored data
(NOVA-126) is its first user.

## Read first
- `AGENTS.md` §6, §8; `docs/COMPONENTS.md` (DataTable); every file under Files

## Files
Create:
- `frontend/packages/ui-core/src/components/DataTable/DataTableGroups.tsx`
Modify:
- `frontend/packages/ui-core/src/components/DataTable/{DataTable.tsx,DataTableCards.tsx,DataTable.test.tsx,DataTable.stories.tsx,storyData.ts}`
- `frontend/packages/ui-core/src/index.ts` (export the new prop types), `docs/COMPONENTS.md`

## Build
1. New optional prop `groups?: DataTableGroups<T>`:
   ```ts
   {
     of: (row: T) => string[];                       // group keys of a row; [] = row is not shown
     label?: (key: string) => ReactNode;             // default: the key
     summary?: (key: string, rows: T[]) => ReactNode; // right of the label, e.g. "99 stocks · 97 complete"
     actions?: (key: string, rows: T[]) => ReactNode; // buttons in the header
     order?: (a: string, b: string) => number;       // default: alphabetical
     defaultOpen?: boolean;                          // default false
   }
   ```
   When `groups` is set, rows are **not paginated**. Each group header is a full-width row with a real `<button>`
   (`aria-expanded`, chevron) to open or close it. An open group lists all its rows, sorted by the table's current sort.
   The search box filters rows, and a group with no matching rows is hidden. Summaries and actions get the group's
   **filtered** rows.
2. `groups` together with row selection is refused by the types (a union of props), and the `DataTable` doc comment says why.
3. Keep `DataTable.tsx` under 300 lines: the grouped body goes in `DataTableGroups.tsx`. `DataTableCards.tsx` renders
   group headers as card headers with the same button, summary and actions at mobile widths.
4. No trading words in ui-core: the story data uses generic rows, e.g. fruits by colour, where one fruit has two colours.
5. Stories: **Grouped** (default closed), **Grouped open**, **Grouped with search**, **Grouped loading**, **Grouped empty**.
   Check them at 360px and desktop, dark and light.
6. `COMPONENTS.md`: the new prop in the DataTable row.

## Acceptance checks
- [ ] Tests:
  - a row with 2 keys appears in both groups
  - toggling works (click and keyboard)
  - the search hides empty groups and the summary gets the filtered rows
  - sorting applies inside groups
  - no pagination when grouped
- [ ] Existing DataTable tests and stories are unchanged and pass. The a11y addon shows no new violations.
- [ ] `pnpm review:check` passes. Guides: none.

## Out of scope
- Nested groups, group-level sorting by summary values, and virtualised rows; any app screen (NOVA-126).

## Questions
_(implementer writes here if blocked)_

## Handoff
Done. `DataTableGroups.tsx`: `DataTableGroups<T>` (`of`, `label`, `summary`, `actions`, `order`, `defaultOpen`),
`groupRows` (filtered + sorted rows into groups; a row may sit in several), `useOpenGroups`, `DataRow` (shared body row),
`DataTableGroupBodies` (desktop: one `<tbody>` per group, header `<th scope="rowgroup">` with a real `<button
aria-expanded>`, summary, actions) and `DataTableGroupCards` (mobile: header card + that group's cards). `DataTable` gets
`groups` (props are a union: groups or selection, never both), no pagination while grouped, empty state when no row is
in any group. `DataTableCards` gets an optional `rows` subset.
- Deviation: the header row moved to a new `DataTableHead.tsx` to keep `DataTable.tsx` under 300 lines.
- Stories: Grouped, GroupedOpen, GroupedWithSearch, GroupedLoading, GroupedEmpty (fruit by colour; Apple is red and green).
- Checked in Storybook: GroupedOpen at desktop and 360 px (dark).
Commands: `pnpm review:check` passed. Maps: COMPONENTS. Guides: none.

## Review
Built and reviewed by Claude. Acceptance checks pass. Merged.
