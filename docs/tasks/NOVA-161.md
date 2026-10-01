# NOVA-161 — Recorded data cards show history (days, gaps, ticks, size)

**Status:** in-progress · **Owner:** Claude · **Branch:** task/NOVA-161 · **Depends on:** NOVA-160

## Goal
Each Recorded data card shows the stock's stored history instead of Monitor's live numbers (D80).

## Read first
- `AGENTS.md`; `docs/DECISIONS.md` row D80; `docs/guides/API.md` row `GET /live/stocks`
- `frontend/apps/nova-relay/src/pages/live/{RecordedDataPage.tsx,RecordedStockCard.tsx,live.test.tsx}`
- `frontend/packages/services/src/{api/live.ts,queries/live.ts}`; `frontend/packages/mocks/src/handlers/live.ts`

## Files
Create:
- `frontend/packages/mocks/data/liveStocks.json`
Modify:
- `frontend/packages/services/src/{api/live.ts,queries/live.ts,queries/keys.ts}` (+ `index.ts` export lines)
- `frontend/packages/mocks/src/{handlers/live.ts,data.ts}`
- `frontend/apps/nova-relay/src/pages/live/{RecordedDataPage.tsx,RecordedStockCard.tsx,live.test.tsx}`
- `docs/guides/USER-GUIDE.md` (Step 7b, Recorded data paragraph)

## Build
1. `getLiveStocks(symbols)` + `useLiveStocks(symbols)` (like `useLiveSnapshot`; no polling, refetch on focus).
2. Mock handler `GET /live/stocks` with the snapshot's checks; fixture covers: several days with no gap, a stock
   with gap days, a stock never stored (zeros, null days).
3. Card (whole card still one link "Open <SYMBOL>"): name; **Days stored** "12 · 1 Oct – 16 Oct 2026"
   ("None yet" at 0); **Gap days** badge **No** (success) or **Yes (N)** (warning), none at 0 days;
   **Ticks** (en-IN short, e.g. "3.2 M") and **Size** (`formatBytes`). Remove price, Last tick, Today and the
   live badges; the page no longer calls `useLiveSnapshot`.
4. Under the search box a muted line: "Updated after each market close."
5. Loading skeleton, `QueryError` with retry, empty and no-match states stay as they are.

## Acceptance checks
- [ ] Cards show days, range, gap badge and ticks/size from the mock; a never-stored stock shows "None yet".
- [ ] Gap stock shows **Yes (N)**; clicking a card opens the day cards; search and pages still work.
- [ ] 360px and desktop, dark and light.
- [ ] Definition of done in `AGENTS.md` §9.

## Out of scope
- Backend (NOVA-160); Monitor; the detail page.
- Merge before NOVA-160 is deployed (the real page would call a missing endpoint).

## Questions
_(implementer writes here if blocked)_

## Handoff
_(implementer, ≤ 20 lines — see `docs/templates/HANDOFF.md`)_

## Review
_(reviewer — Claude or ChatGPT, ≤ 20 lines — see `docs/templates/REVIEW.md`)_
