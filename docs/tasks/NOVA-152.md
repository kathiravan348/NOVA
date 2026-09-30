# NOVA-152 — Relay Live: Monitor cards + Recorded data pages

**Status:** done · **Owner:** Claude · **Branch:** task/NOVA-152 · **Depends on:** NOVA-151

## Goal
A new **Live** sidebar group in Relay with **Monitor** (a card per stock, updating each second) and **Recorded data**
(stock list → date cards) (D74 (1)–(2)).

## Read first
- `AGENTS.md`; `docs/DECISIONS.md` row D74
- `frontend/apps/nova-relay/src/{routes.tsx,layout/AppLayout.tsx}`, `frontend/packages/services/src/queries/live.ts`
- `frontend/apps/nova-relay/src/pages/instruments/InstrumentsPage.tsx` (index picker, search, Pager patterns)

## Files
Create:
- `frontend/apps/nova-relay/src/pages/live/{MonitorPage.tsx,StockCard.tsx,RecordedDataPage.tsx,RecordedStockPage.tsx,DayCard.tsx,live.test.tsx}`
- `frontend/packages/ui-trading/src/components/LiveStockCard/` (component, test, story) if the card is not app-specific
Modify:
- `frontend/apps/nova-relay/src/{routes.tsx,layout/AppLayout.tsx,routes.test.tsx}` (group **Live**: `/live/monitor`, `/live/recorded`, `/live/recorded/:symbol`)
- `docs/{COMPONENTS.md,STRUCTURE.md}`, `docs/guides/USER-GUIDE.md`, `docs/tasks/{BOARD.md,NOVA-152.md}`

## Build
1. **Monitor:** choose an index or a saved list; one card per stock: name, last price (mono), change % (green/red by tokens),
   last tick time, "1,412 / 1,480 s" (seconds with a tick / expected). Card turns amber when the last tick is older than 10 s in market hours.
   Subscribes on mount, unsubscribes on leave; capped at 500 cards with Pager (D74) at 50 per page.
2. **Recorded data:** searchable stock list (name, days recorded, total size); a row opens the stock's page.
3. **Stock page:** one small card per recorded day: date, ticks, 1-second candles, **missing seconds (recorder)** vs **no trade**, size.
   Days with recorder faults are marked with a warning badge.
4. Empty states: recorder off → link to **Config**; no data yet; error with retry. Demo banner in mock mode.
5. Sidebar shows the group with the two items; Config item is added by NOVA-153.

## Acceptance checks
- [x] Mock mode: cards update; stale card turns amber; unsubscribing on leave verified in a test.
- [x] Stock page lists day cards with the two kinds of missing seconds.
- [x] 360px: one card per row; no horizontal scroll. Dark and light both fine.
- [x] Definition of done in `AGENTS.md` §9.

## Out of scope
- Choosing which stocks to record (NOVA-153); charts of ticks; backend.

## Questions
_(implementer writes here if blocked)_

## Handoff
**Done:** **Live** sidebar group (Monitor, Recorded data) in Relay; Monitor cards update from `live.tick`, amber after 10 s without a tick in market hours; stock page with day cards (recorder faults vs no trade).
**Files changed:** relay `pages/live/*`, `lib/live.ts`, `routes.tsx`, `layout/AppLayout.tsx`; ui-trading `LiveStockCard` (+ story, test); mock live handler; COMPONENTS, STRUCTURE, USER-GUIDE.
**Commands run:** focused tests; `pnpm review:check` before ready-for-review.
**Checked:** desktop and 375px in the demo build (no horizontal scroll), dark theme; Storybook story added.
**New dependencies:** none. **Guides updated:** USER-GUIDE (Step 7b).
**Deviations from task:** the Recorded data list shows symbol, name and sector only (no days/size per stock: the API has no per-stock list, only `/live/days?symbol=`); Monitor offers "Recorded stocks" and indices (saved lists come with Config, NOVA-153); the recording-off empty state links to Data jobs until NOVA-153 adds Config. The mock snapshot now returns an empty item for any stock in the mock stock list.
**Known gaps:** none.

## Review
**Result:** done
**Reviewer / built by:** Claude / Claude. **Self-review:** yes (Owner allowed: the other agents are offline; fresh read of the diff, checks re-run).
**Fixed directly (review: commits):** none needed beyond the build.
**Change requests (if sent back):** none.
**Checked:** agent account cannot open or see Live; the card lives in ui-trading with a story and test (apps hold no one-off UI); Monitor subscribes only to the visible page and the snapshot request is capped by page size; no horizontal scroll at 375px; `review:check` passed (1,056 tests).
**Watch:** stock list on Recorded data has no per-stock recorded totals (no API for it); add a list endpoint if wanted.
**Guides checked:** USER-GUIDE Step 7b matches; API unchanged.
**Rulebook issues found:** none.
**Follow-up tasks created:** none.
