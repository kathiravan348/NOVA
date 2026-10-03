# NOVA-173 — Results by symbol: best 5 / worst 5 + "View all" popup; Modal sizes (D82)

**Status:** ready-for-review · **Owner:** ChatGPT · **Branch:** task/NOVA-173 · **Depends on:** NOVA-169 (same result page)

## Goal
A backtest's page shows a short **Results by symbol** (best 5 and worst 5). **View all N symbols** opens a
popup with search, a winners/losers filter, sorting and pages. ui-core `Modal` gets wide sizes for table popups.

## Read first
- `AGENTS.md` §6; `docs/DECISIONS.md` row D82 (8); `docs/COMPONENTS.md` (Modal, DataTable, Pager, Select, Input)
- `frontend/apps/nova-orbit/src/pages/backtests/{SymbolBreakdown,BacktestResultPage}.tsx`; `ui-core/src/components/Modal/*`

## Files
Create:
- `frontend/apps/nova-orbit/src/pages/backtests/SymbolsDialog.tsx`, test `symbols.test.tsx`
Modify:
- `frontend/packages/ui-core/src/components/Modal/{Modal.tsx,Modal.stories.tsx,Modal.test.tsx}`
- `frontend/apps/nova-orbit/src/pages/backtests/{SymbolBreakdown,BacktestResultPage}.tsx`
- `docs/COMPONENTS.md` (Modal row), `docs/guides/USER-GUIDE.md` (Backtest result)

## Build
1. `Modal` prop `size?: "md" | "lg" | "xl"` (default `md` = today's `max-w-lg`; `lg` = `max-w-3xl`; `xl` =
   `max-w-6xl`); below `sm` every size is the full width minus the gutter. Story **Sizes**; test per size.
2. `SymbolBreakdown` shows at most 10 rows: the 5 best and the 5 worst by net P&L, as two small tables
   **Best 5** and **Worst 5** (one table when the run has 10 symbols or fewer). Columns add **Avg per trade**
   (net P&L ÷ trades). Header text: "Results by symbol · 87 symbols · 52 profitable".
3. **View all 87 symbols** opens `SymbolsDialog` (`size="xl"`): **Search** (symbol), **Show** (All / Winners /
   Losers), sortable columns (Symbol, Trades, Win rate, Net P&L, Avg per trade), client-side pages of 25 (data is
   the full `bySymbol` already loaded). **Show trades** closes the popup, filters the trades table and scrolls to it.
4. Older versions (summary only) keep showing no symbol table, as today.

## Acceptance checks
- [x] A run with 30 symbols shows Best 5 and Worst 5, and the popup lists all 30 over 2 pages.
- [x] Search "TCS" and Show Losers narrow the popup rows; Show trades filters the trades table.
- [x] A run with 6 symbols shows one table of 6 and still offers the popup.
- [x] Modal story at 360px and desktop, dark and light; `pnpm review:check`.

## Out of scope
- Backend changes, per-symbol charts, CSV export.

## Questions

## Handoff
- Built by ChatGPT, 3 Oct 2026. Best/worst five, symbol/profitable counts, average profit per trade and full popup.
- Popup: symbol search, All/Winners/Losers, sortable columns, 25-row pages and Show trades closing/filtering/scrolling.
- Modal: optional md/lg/xl sizes, default preserved, mobile gutter, Sizes story and per-size render tests.
- Changed: Modal component/story/tests; SymbolBreakdown, SymbolsDialog, result page, symbols tests, COMPONENTS and USER-GUIDE.
- Checks: 9 focused tests; full review:check green (1111 tests, app and Storybook builds).
- Visual: Sizes story and actual popup at 360px/1440px, dark/light; no modal overflow. Mock preview only.
- Guides: USER-GUIDE (symbol report), COMPONENTS (Modal). Dependencies: none.
- Not merged: independent review required; branch follows task/NOVA-171 in the sequential review chain.
