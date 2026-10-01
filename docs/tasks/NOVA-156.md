# NOVA-156 — Live Monitor: search + My list

**Status:** in-progress · **Owner:** Claude · **Branch:** task/NOVA-156 · **Depends on:** —

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
- [ ] Typing "rel" shows only matching cards (RELIANCE) and page 1.
- [ ] Pick stocks → tick two stocks → Save list → select shows **My list (2)** and only those two cards; reload keeps them.
- [ ] Corrupt `relay.live.myList` value → page still renders (empty list).
- [ ] Existing Monitor tests in `live.test.tsx` still pass unchanged; new tests in `monitor.test.tsx`.
- [ ] 360px and desktop, dark and light: toolbar wraps, no horizontal scroll.
- [ ] Definition of done in `AGENTS.md` §9.

## Out of scope
- Saving My list on the server or sharing it between browsers; more than one list.
- Recorded data page (NOVA-157); any backend change.

## Questions
_(implementer writes here if blocked)_

## Handoff
_(implementer, ≤ 20 lines — see `docs/templates/HANDOFF.md`)_

## Review
_(reviewer — Claude or ChatGPT, ≤ 20 lines — see `docs/templates/REVIEW.md`)_
