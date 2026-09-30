# NOVA-152 — Relay Live: Monitor cards + Recorded data pages

**Status:** planned · **Owner:** — · **Branch:** task/NOVA-152 · **Depends on:** NOVA-151

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
- [ ] Mock mode: cards update; stale card turns amber; unsubscribing on leave verified in a test.
- [ ] Stock page lists day cards with the two kinds of missing seconds.
- [ ] 360px: one card per row; no horizontal scroll. Dark and light both fine.
- [ ] Definition of done in `AGENTS.md` §9.

## Out of scope
- Choosing which stocks to record (NOVA-153); charts of ticks; backend.

## Questions
_(implementer writes here if blocked)_

## Handoff
_(implementer, ≤ 20 lines — see `docs/templates/HANDOFF.md`)_

## Review
_(reviewer — see `docs/templates/REVIEW.md`)_
