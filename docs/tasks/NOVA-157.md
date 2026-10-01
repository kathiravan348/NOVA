# NOVA-157 — Live Recorded data: stock cards instead of the table

**Status:** planned · **Owner:** — · **Branch:** task/NOVA-157 · **Depends on:** —

## Goal
**Live → Recorded data** shows one card per recorded stock with today's status; a card opens the same detail page (D78).

## Read first
- `AGENTS.md`; `docs/DECISIONS.md` row D78; `docs/guides/API.md` row `GET /live/snapshot`
- `frontend/apps/nova-relay/src/pages/live/{RecordedDataPage.tsx,MonitorPage.tsx,DayCard.tsx,live.test.tsx}`
- `frontend/apps/nova-relay/src/lib/live.ts` (`isMarketOpen`, `isStale`, `formatClock`)

## Files
Create:
- `frontend/apps/nova-relay/src/pages/live/RecordedStockCard.tsx`
Modify:
- `frontend/apps/nova-relay/src/pages/live/RecordedDataPage.tsx`
- `frontend/apps/nova-relay/src/pages/live/live.test.tsx` (the "Recorded data" block only)
- `docs/guides/USER-GUIDE.md` (Step 7b, Recorded data paragraph)

## Build
1. Stocks = universe entries in `useRecorder().data.symbols` (all universe entries when that list is empty), symbol order.
2. Toolbar: `Input` **Search stocks** (symbol or name, case-insensitive) above the grid; `Pager` below
   (`usePageState(search)`, sizes 25/50/100/200). Grid like Monitor: 1 / 2 / 3 / 4 columns.
3. `useLiveSnapshot(symbols of the current page)` (no WebSocket here). Card per stock, all of it one `Link` to
   `/live/recorded/<symbol>` (accessible name "Open <SYMBOL>"), hover/focus ring per design tokens:
   - title symbol, name (truncated), last price (`PriceText`, "—" if none), **Last tick** (`formatClock`, "—").
   - **Today**: `secondsWithTick / secondsExpected` en-IN with the whole-number % (e.g. "14,900 / 15,301 (97%)"); "—" when expected is 0.
   - Badge: market open and `isStale` false → **Recording** (success); market open and `secondsWithTick` 0 → **No ticks today** (warning);
     market open and stale → **No recent tick** (warning); market closed → no badge.
4. States: skeleton while loading; `QueryError` with retry for universe or snapshot errors; no stocks → existing
   "No stocks yet" empty state; search with no match → "No stock matches “<text>”".
5. Remove the `DataTable` code from the page. Detail page `RecordedStockPage` is unchanged.

## Acceptance checks
- [ ] Recorded data shows cards (not a table) with price, last tick and "Today" for mock stocks; only recorder stocks.
- [ ] Clicking the TCS card opens the day cards (existing test adapted); DMART "Nothing recorded" test unchanged.
- [ ] Search "tc" narrows to TCS; snapshot error shows **Try again**.
- [ ] 360px and desktop, dark and light; cards are keyboard-focusable links.
- [ ] Definition of done in `AGENTS.md` §9.

## Out of scope
- History totals per stock (days, total ticks, size) — would need a new endpoint (D78 option not chosen).
- Live price updates on this page; Monitor (NOVA-156); any backend change.

## Questions
_(implementer writes here if blocked)_

## Handoff
_(implementer, ≤ 20 lines — see `docs/templates/HANDOFF.md`)_

## Review
_(reviewer — Claude or ChatGPT, ≤ 20 lines — see `docs/templates/REVIEW.md`)_
