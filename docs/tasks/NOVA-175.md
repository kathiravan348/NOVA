# NOVA-175 — Backtest Timeline popup (day ledger) (D82)

**Status:** done · **Owner:** Claude · **Branch:** task/NOVA-175 · **Depends on:** NOVA-173, NOVA-174

## Goal
A backtest's page has a **Timeline** button. It opens a popup with one row per trading day (buys, sells,
charges, cash, holdings, equity); expanding a day lists each buy and sell with its quantity, price, cost,
reason and the cash left after it.

## Read first
- `AGENTS.md` §6, §7; `docs/DECISIONS.md` row D82 (9); `docs/COMPONENTS.md` (Modal `size`, DataTable, Pager, Switch, DateTimePicker)
- `frontend/apps/nova-orbit/src/pages/backtests/BacktestResultPage.tsx`; ledger hooks in `services/src/queries/orbit.ts` (NOVA-174)

## Files
Create:
- `frontend/packages/ui-core/src/components/DataTable/DataTableDetails.stories.tsx`
- `frontend/apps/nova-orbit/src/pages/backtests/TimelineDialog.tsx`, `TimelineDayEvents.tsx`, test `timeline.test.tsx`
Modify:
- `frontend/packages/ui-core/src/components/DataTable/{DataTable.tsx,DataTableCards.tsx,DataTable.test.tsx}` (optional inline row details)
- `docs/COMPONENTS.md` (DataTable row details)
- `frontend/apps/nova-orbit/src/pages/backtests/BacktestResultPage.tsx` (the button only)
- `frontend/apps/nova-orbit/src/lib/format.ts` (`exitReasonLabel`)
- `docs/guides/USER-GUIDE.md` (Backtest result → Timeline; explain "cash" and "holdings")

## Build
1. **Timeline** button (secondary, next to Compare) on completed runs whose report is kept.
2. `TimelineDialog` (Modal `size="xl"`): filters **Stock** (search box, sends `symbol`), **From** / **To**
   (IST dates inside the run's period), **Show days without trades** switch (`allDays`). Table, oldest first,
   server paging (Pager, 25 per page): Date, Buys, Sells, Bought, Sold, Charges, Day P&L (PnLText), Cash,
   Holdings, Equity. Money in INR with Indian grouping, mono, right-aligned.
3. Each row has an expand button (`aria-expanded`). `TimelineDayEvents` loads that day's events
   (`/ledger/{date}`) and shows Time (IST, seconds for recorded runs), Stock, Buy/Sell, Qty, Price, Amount,
   Charges, Net P&L (sells), Reason (**Signal**, **Stop-loss**, **Target**, **Time exit**, **Square-off 15:20**,
   **Market filter**, **Rotation**, **End of period**; "—" when unknown), Cash after.
   Note under a day with averaged buys: "Added buys are shown as one buy at the average price."
4. Mobile: rows become cards (DataTable), the expanded day shows events as cards.
5. Loading, empty ("No trades in these days") and error states (QueryError with retry).

## Acceptance checks
- [x] Mock run: the popup lists days; expanding one shows its buys and sells with cash after each.
- [x] Stock filter shows only that stock's days; the switch adds quiet days; From/To limit the rows.
- [x] An old trade without a reason shows "—"; a summary-only version has no Timeline button.
- [x] Checked at 360px and desktop, dark and light; `pnpm review:check`.

## Out of scope
- Backend changes, a calendar view, CSV export, charts inside the popup.

## Questions
- Scope clarification (ChatGPT, planner): the shared DataTable needs optional row details to expand a day inline in tables and mobile cards. Add this generic capability with a story and render test before using it in Timeline.

## Handoff

**Done:** Timeline, day/event filters, 25-row server pages and inline desktop/mobile expansion.
**Files changed:** listed files, plus shared DataTable row details and its generic story/test.
**Commands run:** focused 22 tests; review:check (1,130 tests, both apps and Storybook), all pass.
**Checked:** 360px and 1440px, dark and light; Timeline and RowDetails story screenshots inspected.
**New dependencies:** none. **Maps:** COMPONENTS. **Guides:** USER-GUIDE.
**Deviations:** shared generic row-detail renderer needed for inline expansion; added to scope before implementation.
**Known gaps:** independent review pending; desktop tables scroll sideways. Averaging note appears on buy days of averaging-enabled strategies.

## Review
**Result:** done (3 Oct 2026).
**Reviewer / built by:** Claude / ChatGPT. **Self-review:** no.
**Fixed directly (review: commits):** none needed.
**Checks:** frontend gate on the full stack (171–176): format, lint, typecheck, 1141 tests, app + Storybook builds green (the slow relay `approvalBatch` test timed out twice under full parallel load, passes alone in 6.4 s on main and branch; tests re-run with 4 workers all green). Backend gate: 1413 passed.
**Acceptance:** day list, expand to events with cash after, stock/date/all-days filters, "—" reason, no button on
summary-only versions: all tested. DataTable `renderRowDetails` has a story and a test.
**Guides checked:** USER-GUIDE Timeline paragraph and COMPONENTS DataTable row match the diff.
**Rulebook issues found:** none. **Follow-up tasks created:** none.
