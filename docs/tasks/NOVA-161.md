# NOVA-161 — Recorded data cards show history (days, gaps, ticks, size)

**Status:** ready-for-review · **Owner:** Claude · **Branch:** task/NOVA-161 · **Depends on:** NOVA-160

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
- [x] Cards show days, range, gap badge and ticks/size from the mock; a never-stored stock shows "None yet".
- [x] Gap stock shows **Yes (N)**; clicking a card opens the day cards; search and pages still work.
- [x] 360px and desktop, dark and light.
- [x] Definition of done in `AGENTS.md` §9.

## Out of scope
- Backend (NOVA-160); Monitor; the detail page.
- Merge before NOVA-160 is deployed (the real page would call a missing endpoint).

## Questions
_(implementer writes here if blocked)_

## Handoff
- `getLiveStocks` / `useLiveStocks` (no polling) + key; mock handler + `liveStocks.json` (gap stock TCS,
  one-day HDFCBANK; others never stored).
- Card: **Days stored** "10 days · 14 Sep – 29 Sep 2026" or **None yet**; badge **Gap days: No / Yes (N)**;
  **Ticks** in Indian short form (lakh/crore, e.g. 26.5L); **Size**. Price, Last tick, Today and live badges removed;
  the page no longer calls `/live/snapshot`. Note under search: "Updated after each market close."
- Tests: Recorded data block in `live.test.tsx` (history card, None yet, recorder list + search, history error,
  card opens day cards). lint/typecheck/test (1,074)/build/format pass.
- **Merge only after NOVA-160 is deployed** (after 15:45 IST); before that the real page would get a 404.
- Guides: `USER-GUIDE.md` Step 7b.

## Review
Self-review by Claude, allowed by the Owner on 1 Oct 2026: matches the task; the detail page is unchanged.
Verdict: approved; merge right after the NOVA-160 deploy.
