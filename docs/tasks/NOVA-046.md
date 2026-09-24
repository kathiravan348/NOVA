# NOVA-046 — Load more on paged lists; strategy detail filters by `strategyId`

**Status:** done · **Owner:** Claude · **Branch:** task/NOVA-046 · **Depends on:** NOVA-045

## Goal
Every screen that shows a paged list (D32) can load the next page, and the strategy detail *Backtests* tab asks
the server for that strategy's runs (`?strategyId=`) instead of filtering every run in the browser.

## Read first
- `AGENTS.md` (§6), `docs/DECISIONS.md` (D32), `docs/COMPONENTS.md`
- `frontend/packages/services/src/queries/{orbit.ts,relay.ts,paging.ts}`
- `frontend/packages/ui-core/src/components/EmptyState/*` (component + story + test pattern)

## Files
Create: `frontend/packages/ui-core/src/components/LoadMore/{LoadMore.tsx,LoadMore.stories.tsx,LoadMore.test.tsx}`
Modify: `frontend/packages/ui-core/src/index.ts`, `docs/COMPONENTS.md`,
Orbit `src/pages/{backtests/BacktestsPage.tsx,backtests/BacktestResultPage.tsx,strategies/StrategyDetailPage.tsx,compare/ComparePage.tsx}`
and their tests if affected, Relay `src/pages/{audit/AuditPage.tsx,data-jobs/DataJobsPage.tsx}` (+ tests)

## Build
1. ui-core `LoadMore({ hasMore, loading, onLoadMore, label = "Load more" })`: renders nothing when `!hasMore`;
   otherwise a centred secondary `Button` (disabled + "Loading…" while `loading`). Generic words only; no data fetching.
2. Stories: default, loading, custom label, no more. Test: click calls `onLoadMore`; disabled while loading; hidden when done.
3. Pages: under each paged table render
   `<LoadMore hasMore={query.hasNextPage} loading={query.isFetchingNextPage} onLoadMore={() => void query.fetchNextPage()} />`
   (backtests, result trades, strategy detail backtests, audit, data jobs, compare run picker).
4. `StrategyDetailPage` Backtests tab: `useBacktests({ strategyId })`; drop the client-side filter.
5. Page tests: one test per app proves the button appears when the server has another page and loads it
   (override the handler with `paginate(..., limit 2)`, as in `services/src/queries/queries.test.tsx`).

## Acceptance checks
- [x] With the default limit (50) no Load more button shows (all mock rows fit); with limit 2 it appears and loads.
- [x] Strategy detail requests `/api/v1/backtests?strategyId=<id>` (asserted in a test).
- [x] Story checked at 360px and desktop, dark and light. Definition of done in `AGENTS.md` §9.

## Out of scope
- Infinite scroll, server-side search or filters beyond `strategyId`, page-size pickers, backend code.

## Questions
_(implementer writes here if blocked)_

## Handoff
**Done:** Built by Claude on Owner request (2026-09-24). ui-core `LoadMore` + story + test; six paged lists use it;
strategy detail asks `?strategyId=`.
**Commands run:** `pnpm review:check` pass (91 test files). **Checked:** `Core/LoadMore` at 360px dark (default) and light (loading).
**New dependencies:** none. **Maps updated:** COMPONENTS.
**Deviations:** `.claude/launch.json` Storybook configs now also start through `fnm exec` (same fix as NOVA-060;
Storybook would not start without it). Audit group filter and trade symbol filter still apply to loaded rows only.
**Known gaps:** none.

## Review
**Result:** done
**Fixed directly:** dropped the "Showing N" note from the plan (no screen needed it).
**Rulebook issues found:** none. **Follow-up tasks created:** none.
