# NOVA-097 — Instruments from any timeframe; backtest coverage by the strategy's timeframe

**Status:** done · **Owner:** Claude · **Branch:** task/NOVA-097 · **Depends on:** NOVA-098

## Goal
A stock with only intraday candles (e.g. 1 year of 1m) appears on Market data and in **Run backtest**, and
the backtest form checks data coverage for the chosen strategy's timeframe (Owner report 26 Sep 2026:
"Symbols not loaded" with only 1m data).

## Read first
- `AGENTS.md`; `backend/services/atlas/src/nova_atlas/market_data.py`, `tests/test_market_data.py`
- `frontend/packages/contracts/src/marketData.ts` (`Instrument`), `frontend/packages/mocks/data/instruments.json`
- `frontend/apps/nova-orbit/src/components/InstrumentTable.tsx`, `pages/backtests/{NewBacktestPage,UniverseFields,backtests.test}.tsx`

## Files
Modify:
- `backend/services/atlas/src/nova_atlas/market_data.py`, `tests/test_market_data.py`
- Contracts: `Instrument` (Zod + Pydantic + tests, schema), mocks `instruments.json`
- `frontend/apps/nova-orbit/src/components/InstrumentTable.tsx`, `pages/backtests/{NewBacktestPage,UniverseFields,backtests.test}.tsx`
- `docs/guides/{API,USER-GUIDE}.md`, `docs/CONTRACTS.md`

## Build
1. `Instrument` gains `coverage: [{timeframe, from, to}]` (IST dates, one per stored timeframe, finest first).
   `dataFrom`/`dataTo` = the widest range over all timeframes.
2. Prices come from daily bars when there are any, else from intraday bars rolled up per IST day
   (last close, previous day's close, 52-week high/low, 20-day average volume). A stock with no candles is
   still left out.
3. Backtest form: the table's coverage flag and the "Partial data" check use the selected strategy's
   timeframe (`coverage` entry for it; missing = not covered). The default **To** date is the latest date of
   that timeframe.
4. Market data page unchanged except it now lists intraday-only stocks.

## Acceptance checks
- [ ] pytest: 1m-only stock listed with prices from its 1m bars; coverage per timeframe; daily wins when present.
- [ ] Vitest: a 1m strategy sees 1m coverage; a 1d strategy flags a 1m-only stock as not covered.
- [ ] Owner stack: Run backtest lists the NIFTY 50 stocks with 1m data.
- [ ] Definition of done in `AGENTS.md` §9.

## Out of scope
- Building 5m/15m candles from 1m. Changing the backtest engine.

## Questions

## Handoff
**Done:** `Instrument.coverage` per timeframe; intraday-only stocks listed with prices rolled up per IST day (TimescaleDB `last()`), list cached until a download completes or is deleted (10 min max); backtest form checks coverage and the default end date in the strategy's timeframe ("No 5m data" badge).
**Files changed:** as listed; plus `settings.py`, `main.py` (cache), `marketData.test.ts`, `jsonSchema` output.
**Commands run:** backend-check (665 passed) · `pnpm review:check` → pass.
**Owner stack:** 63 stocks with only 1m data now listed in Run backtest; list build 0.5–1 s, then cached.
**New dependencies:** none. **Maps updated:** CONTRACTS. **Guides updated:** API, USER-GUIDE.
**Deviations from task:** added a cache (the roll-up of a year of 1m bars would run on every page load).

## Review
**Result:** done (built and merged by Claude at the Owner's request).
**Fixed directly:** roll-up with `array_agg(... ORDER BY)` took 4 s on 58 lakh rows → `last(close, ts)` 0.5 s.
**Guides checked:** API, USER-GUIDE, CONTRACTS match. **Rulebook issues found:** none. **Follow-up tasks created:** none.
