# NOVA-036 — Market data page: instrument list with search and info

**Status:** done · **Owner:** Claude · **Branch:** main · **Depends on:** NOVA-030, NOVA-033

## Goal
The market data page uses the same instrument list as the symbol picker (R2) instead of a plain select:
search, index/sector/F&O filters and the instrument facts; clicking a symbol shows its chart and info.

## Files
Modify: Orbit `pages/market-data/{MarketDataPage.tsx,marketData.test.tsx}` (uses `components/InstrumentTable.tsx`
from NOVA-035).

## Acceptance checks
- [x] Chart card on top with a timeframe select; `?symbol=&tf=` still drives it; unknown symbol falls back.
- [x] Info: exchange/segment, sector, index, last close, day change, 52-week range, avg volume, F&O lot, data range.
- [x] Symbols without candles (e.g. DABUR) show the chart's "No candles" state.

## Out of scope
- Candles for the 21 new symbols, live prices.

## Handoff
**Done:** Built by Claude directly on `main` (Gemini offline; Owner request 2026-09-23).
**Checked:** market data tests (5) pass; typecheck and lint pass.

## Review
**Result:** done (self-built; no separate review).
