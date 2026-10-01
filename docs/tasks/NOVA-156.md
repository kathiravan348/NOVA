# NOVA-156 — Live Monitor: search + My list

**Status:** done · **Owner:** Claude · **Branch:** task/NOVA-156 · **Depends on:** —

## Goal
On **Live → Monitor** the Owner can search the cards and keep an own list of stocks to watch (D78).

## Read first
- `AGENTS.md`; `docs/DECISIONS.md` row D78
- `frontend/apps/nova-relay/src/pages/live/MonitorPage.tsx`
- `frontend/apps/nova-relay/src/pages/data-jobs/BulkStockPicker.tsx` (reuse as is)
- `frontend/apps/nova-relay/src/pages/live/RecorderSymbolsModal.tsx` (pattern: Modal + BulkStockPicker + Save)
- `frontend/packages/ui-core/src/theme/theme.ts` (pattern: guarded `localStorage`)

## Files
Create:
- `frontend/apps/nova-relay/src/lib/myList.ts` — `loadMyList(): string[]`, `saveMyList(symbols)`; key `relay.live.myList`; every read/write in try/catch (bad JSON or no storage → `[]`)
- `frontend/apps/nova-relay/src/pages/live/MyListModal.tsx`
- `frontend/apps/nova-relay/src/pages/live/monitor.test.tsx`
Modify:
- `frontend/apps/nova-relay/src/pages/live/MonitorPage.tsx`
- `docs/guides/USER-GUIDE.md` (Step 7b, Monitor paragraph)

## Build
1. Toolbar row (wraps at 360px): **Stocks** select, an `Input` labelled **Search stocks** (placeholder "Symbol or name"), a **Pick stocks** button.
2. Stocks select gets a new first-after-Recorded option **My list (N)** (value `mylist`). Its stocks = universe entries whose symbol is in `loadMyList()`, in symbol order.
3. Search filters the chosen list by symbol or name (case-insensitive, trimmed) **before** paging; `usePageState` reset key = `${source}|${search}`.
4. **Pick stocks** opens `MyListModal` (title "My list"): `BulkStockPicker` over all universe entries, preselected with the saved list; **Save list** writes `saveMyList`, closes, switches the select to **My list**, and shows a toast "My list saved (N stocks)". **Cancel** discards.
5. Empty states: My list empty → "Your list is empty" + text "Use Pick stocks to choose stocks to watch."; search with no match → "No stock matches “<text>”".
6. Live ticks/snapshot stay per page as now (≤ 200 per page, under the 500-symbol limit).

## Acceptance checks
- [x] Typing "rel" shows only matching cards (RELIANCE) and page 1.
- [x] Pick stocks → tick two stocks → Save list → select shows **My list (2)** and only those two cards; reload keeps them.
- [x] Corrupt `relay.live.myList` value → page still renders (empty list).
- [x] Existing Monitor tests in `live.test.tsx` still pass unchanged; new tests in `monitor.test.tsx`.
- [x] 360px and desktop, dark and light: toolbar wraps, no horizontal scroll.
- [x] Definition of done in `AGENTS.md` §9.

## Out of scope
- Saving My list on the server or sharing it between browsers; more than one list.
- Recorded data page (NOVA-157); any backend change.

## Questions
_(implementer writes here if blocked)_

## Handoff
- Monitor toolbar: Stocks select (+ **My list (N)**), **Search stocks**, **Pick stocks** (wraps at 360px).
- `lib/myList.ts`: guarded localStorage (`relay.live.myList`); bad JSON → `[]`. Save also updates state, so a
  browser that blocks storage still shows the list for the visit.
- `MyListModal`: `BulkStockPicker` over all universe stocks; Save switches the select to My list + toast.
- Fix found by the new tests: "Recording is off" showed while prices for a new page/search were still loading
  (and hid the empty-list / no-match messages). Now list checks come first and "off" needs a loaded snapshot.
- Tests: `monitor.test.tsx` (5); `live.test.tsx` unchanged and green. `pnpm lint/typecheck/test/build/format:check` pass.
- Browser check not possible: the in-app browser blocks the MSW service worker (demo mode), and Live pages are
  Owner-only in real mode. Layout reviewed in code (flex-wrap, full-width fields below `sm`).
- Guides: `USER-GUIDE.md` Step 7b (Monitor paragraph).

## Review
Self-review by Claude, allowed by the Owner on 1 Oct 2026 ("other agents are down, complete all works").
- Diff matches the task: search before paging, page reset on list/search change, My list option + empty state.
- No backend change; snapshot/ticks still per page (≤ 200 symbols, under the 500 limit).
- Verdict: done, merged.
