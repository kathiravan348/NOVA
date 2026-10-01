# NOVA-154 — Recorder: Pick top 3000 by traded value

**Status:** planned · **Owner:** — · **Branch:** task/NOVA-154 · **Depends on:** NOVA-153

## Goal
In **Live → Config → Stocks to record**, one button fills the selection with the 3,000 synced stocks that trade the most
(D75), so the recorder fits Kite's 3,000 limit with 3,899 stocks synced.

## Read first
- `AGENTS.md`; `docs/DECISIONS.md` row D75
- `frontend/apps/nova-relay/src/pages/live/{RecorderSymbolsModal.tsx,config.test.tsx}`
- `frontend/packages/services/src/queries/marketData.ts` (`useInstruments`, `useUniverse`), `frontend/packages/contracts/src/marketData.ts`

## Files
Create:
- `frontend/apps/nova-relay/src/pages/live/topByTradedValue.ts` (+ `topByTradedValue.test.ts`)
Modify:
- `frontend/apps/nova-relay/src/pages/live/RecorderSymbolsModal.tsx`, `config.test.tsx`
- `docs/guides/USER-GUIDE.md`, `docs/tasks/{BOARD.md,NOVA-154.md}`

## Build
1. `topByTradedValue(synced: string[], instruments: Instrument[], limit)` → symbols sorted by `avgDailyVolume × lastClosePaise`
   descending, ties by symbol; only symbols in `synced`. Stocks without an instrument row (no daily bars) go last, by symbol,
   until `limit` is reached. Pure function, no I/O.
2. In `SymbolsForm`, a secondary button **Pick top 3000 by traded value** (use `MAX_RECORDER_SYMBOLS`) calls it with
   `useInstruments()` and `setSymbols(...)`. Disabled while either query loads; shows the `QueryError` if instruments fail.
   It only fills the selection: the Owner still presses **Save stocks**.
3. A hint under the button: "Ranked by 20-day average volume × last close; stocks with no history rank last."

## Acceptance checks
- [ ] Unit test: ranking, ties, unsynced symbols ignored, unranked stocks last, exactly `limit` returned when more exist.
- [ ] Modal test: with 3,899 synced mock stocks the button selects 3,000 and Save sends 3,000 symbols.
- [ ] Definition of done in `AGENTS.md` §9.

## Out of scope
- Backend changes; auto-refreshing the list daily; raising the 3,000 cap or sharding connections.

## Questions
_(implementer writes here if blocked)_

## Handoff
_(implementer, ≤ 20 lines — see `docs/templates/HANDOFF.md`)_

## Review
_(reviewer — Claude or ChatGPT, ≤ 20 lines — see `docs/templates/REVIEW.md`)_
