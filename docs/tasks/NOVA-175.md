# NOVA-175 — Backtest Timeline popup (day ledger) (D82)

**Status:** in-progress · **Owner:** ChatGPT · **Branch:** task/NOVA-175 · **Depends on:** NOVA-173, NOVA-174

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
- [ ] Mock run: the popup lists days; expanding one shows its buys and sells with cash after each.
- [ ] Stock filter shows only that stock's days; the switch adds quiet days; From/To limit the rows.
- [ ] An old trade without a reason shows "—"; a summary-only version has no Timeline button.
- [ ] Checked at 360px and desktop, dark and light; `pnpm review:check`.

## Out of scope
- Backend changes, a calendar view, CSV export, charts inside the popup.

## Questions
- Scope clarification (ChatGPT, planner): the shared DataTable needs optional row details to expand a day inline in tables and mobile cards. Add this generic capability with a story and render test before using it in Timeline.

## Handoff
