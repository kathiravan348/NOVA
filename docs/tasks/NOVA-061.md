# NOVA-061 — Atlas: market-data endpoints (instruments with computed stats, candles by range)

**Status:** done · **Owner:** Claude · **Branch:** task/NOVA-061 · **Depends on:** NOVA-051

## Goal
`GET /market-data/instruments` and `GET /market-data/candles` serve real data from `instruments` + `candles`, in
the frozen `Instrument` and `Candle` contracts, so Orbit's market-data page and symbol picker can switch to real (059).

## Read first
- `AGENTS.md` (§7, §8), `docs/DECISIONS.md` (D11, D17, D32, D37, D41), `frontend/packages/contracts/src/marketData.ts`
- `frontend/packages/mocks/data/{instruments,candles}.json`, `backend/services/atlas/src/nova_atlas/{main.py,jobs.py}`

## Files
Create: `nova_atlas/market_data.py`, `services/atlas/tests/test_market_data.py`, `nova_contracts/market_data.py`
+ `tests/test_market_data.py`
Modify: `nova_atlas/main.py`, `nova_contracts/__init__.py`, `docs/CONTRACTS.md`

## Build
1. Pydantic `Instrument` (4 refinements) and `Candle` (`time`: ISO date or UTC datetime; high/low refinements);
   parity vs mocks.
2. Instruments: only rows with daily (`1d`) candles are listed (the contract needs a last close). From the daily
   series, in one SQL query: last close, change % vs the previous close (2 decimals; 0 with one bar), 52-week
   high/low (365 days back from the last bar), average volume of the last 20 bars, first/last bar date (IST);
   `timeframes` = every timeframe with candles, in contract order. Sorted by symbol.
3. Candles: `symbol` and `timeframe` required; `from`/`to` (IST dates) optional — default the last 365 days (1d) or
   5 days (intraday) ending at the last bar; longest span 3,660 days (1d) / 60 days (intraday). Unknown symbol → 404;
   bad range → 400. `time` = `YYYY-MM-DD` (IST) for 1d, UTC `Z` otherwise; oldest first.

## Acceptance checks
- [x] Tests: computed stats on seeded candles, schema parity for both endpoints, range defaults/limits, 404/400.
- [x] `backend-check` passes. Definition of done in `AGENTS.md` §9.

## Out of scope
- Screens (059); making `from`/`to` required (059, when the screen sends them); benchmark/index series.

## Handoff
**Done:** Built by Claude on Owner request (2026-09-25). Instruments with SQL-computed stats; candles by IST date range.
**Commands run:** `backend-check` pass (227 tests).
**New dependencies:** none.
**Deviations:** none. `from`/`to` stay optional until NOVA-059 sends them (D32 target: required).
**Known gaps:** coverage (`dataFrom`/`dataTo`) is the daily series; intraday coverage is not shown separately.

## Review
**Result:** done
**Fixed directly:** none needed beyond line lengths.
**Rulebook issues found:** none. **Follow-up tasks created:** none (059 makes the range required).
