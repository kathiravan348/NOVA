# NOVA-148 — Screens use Pager instead of Load more

**Status:** planned · **Owner:** — · **Branch:** task/NOVA-148 · **Depends on:** NOVA-146, NOVA-147

## Goal
Long lists show "Showing 1–50 of 1,240", page numbers and **Rows per page** (D74 (5)); the **Load more** button leaves the screens.

## Read first
- `AGENTS.md`; `docs/DECISIONS.md` row D74
- `frontend/packages/ui-core/src/components/Pager/Pager.tsx`, `frontend/packages/services/src/queries/paging.ts`

## Files
Modify:
- `frontend/packages/services/src/queries/{orbit.ts,relay.ts,approvals.ts,marketData.ts,downloads.ts,paging.ts}` (page hooks take `page` + `pageSize`, use `offset`, keep the previous page while loading)
- Orbit: `pages/backtests/{BacktestsPage,BacktestResultPage}.tsx`, `pages/strategies/StrategyDetailPage.tsx`, `pages/compare/ComparePage.tsx`
- Relay: `pages/data-jobs/DataJobsPage.tsx`, `pages/audit/AuditPage.tsx`, `pages/approvals/ApprovalList.tsx`, `pages/stored-data/UnavailableDataPanel.tsx`
- Their tests; `docs/guides/USER-GUIDE.md`, `docs/tasks/{BOARD.md,NOVA-148.md}`

## Build
1. Each list holds `page` (1-based) and `pageSize` (25/50/100/200, default 50) in state and renders `Pager` under the table.
   Changing a filter, search or size goes back to page 1.
2. A hook's key includes `page`, `pageSize` and filters; `placeholderData: keepPreviousData` avoids flicker.
3. Realtime updates (D57) still refresh the visible page. Approvals: bulk selection is per page and clears on page change.
4. `LoadMore` stays in ui-core; remove only its uses in these screens.
5. Tests: page 2 shows the next rows; size change resets to page 1; the total is shown.

## Acceptance checks
- [ ] Each screen listed shows total, page numbers and Rows per page in mock and real mode; no **Load more** left on them.
- [ ] 360px: pager wraps to two rows; no horizontal scroll.
- [ ] Definition of done in `AGENTS.md` §9.

## Out of scope
- Backend changes; Stored data coverage table (client-side already); server-side sorting.

## Questions
_(implementer writes here if blocked)_

## Handoff
_(implementer, ≤ 20 lines — see `docs/templates/HANDOFF.md`)_

## Review
_(reviewer — see `docs/templates/REVIEW.md`)_
