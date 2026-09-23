# NOVA-030 — Instrument info + 24 mock instruments

**Status:** done · **Owner:** Claude · **Branch:** task/NOVA-030 · **Depends on:** NOVA-029

## Goal
`Instrument` carries the facts a person needs to pick symbols for a backtest (PLAN R2), and the mock
list has 24 NSE instruments, so the symbol picker (NOVA-035) and market data list (NOVA-036) have real-looking data.

## Read first
- `AGENTS.md` (§7), `docs/PLAN.md` (Review round 1, R2), `docs/DECISIONS.md` (D17)
- `frontend/packages/contracts/src/{marketData.ts,marketData.test.ts,strategy.ts}` (for `IndexNameSchema`)
- `frontend/packages/mocks/data/{instruments.json,candles.json}`, `frontend/packages/mocks/src/marketData.consistency.test.ts`

## Files
Modify:
- `frontend/packages/contracts/src/marketData.ts`, `frontend/packages/contracts/src/marketData.test.ts`
- `frontend/packages/mocks/data/instruments.json`, `frontend/packages/mocks/src/marketData.consistency.test.ts`
- `docs/CONTRACTS.md` (Instrument line: mention the new fields)

## Build
1. Add to `InstrumentSchema` (strict, D17): `sector: string (min 1)`, `indices: IndexName[]` (unique, may be empty),
   `lastClosePaise`, `high52wPaise`, `low52wPaise` (positive ints), `changePercent: number` (day change),
   `avgDailyVolume: int ≥ 0`, `lotSize: int > 0 | null` (null = not in F&O). Refines: `low52w ≤ lastClose ≤ high52w`, indices unique.
2. Schema tests: one valid sample; one failing sample per new refine; `lotSize` null accepted.
3. `instruments.json`: 24 NSE `equity_delivery` instruments. Keep RELIANCE, TCS, INFY first (same
   `timeframes`/`dataFrom`/`dataTo`). Add HDFCBANK and ICICIBANK (used by strategy mocks), SBIN, KOTAKBANK,
   AXISBANK, ITC, LT, BHARTIARTL, HINDUNILVR, BAJFINANCE, MARUTI, SUNPHARMA, TITAN, ASIANPAINT, WIPRO,
   HCLTECH, NTPC (20 × `NIFTY 50`; the five banks also `NIFTY BANK`), plus DMART, PIDILITIND, HAVELLS, DABUR
   (`NIFTY NEXT 50`). New ones: `timeframes: ["1d"]`, `dataTo: "2026-09-18"`; PIDILITIND and DABUR
   `dataFrom: "2026-08-03"` (short history, to test coverage warnings), others `"2026-06-29"`.
   Give 4–6 of them `lotSize: null`. Static hand-written numbers, no runtime maths; values are mock.
4. Consistency test: RELIANCE/TCS/INFY `lastClosePaise` equals the close of their last `1d` candle;
   every symbol used in `strategies.json` universes exists in `instruments.json`; symbols unique.

## Acceptance checks
- [x] `pnpm test` passes the new schema and consistency tests; mocks parse in `data.ts` unchanged.
- [x] `/market-data` still works (the select now lists 24; symbols without candles show the chart's empty state).
- [x] Definition of done in `AGENTS.md` §9.

## Out of scope
- Any screen change, handler query params, candles for new symbols, index constituents endpoint.
- Moving universe out of strategies (NOVA-031).

## Questions

## Handoff
**Done:** Added Instrument info fields to InstrumentSchema and expanded mock instruments list to 24 NSE equities with schema & consistency tests.
**Files changed:**
- `frontend/packages/contracts/src/marketData.ts`
- `frontend/packages/contracts/src/marketData.test.ts`
- `frontend/packages/mocks/data/instruments.json`
- `frontend/packages/mocks/src/marketData.consistency.test.ts`
- `docs/CONTRACTS.md`
**Commands run:** `pnpm run review:check` (lint, typecheck, test, build, format:check) → all pass (yes).
**Checked:** headless contract/mock data task (no UI component modified; market data page smoke tests pass).
**New dependencies:** none.
**Maps updated:** CONTRACTS.
**Deviations from task:** none.
**Known gaps:** none.

## Review
**Result:** done
**Fixed directly (review: commits):**
- `instruments.json`: `changePercent` of RELIANCE/TCS/INFY did not match their last two `1d` candles (AGENTS §7 consistent numbers); now 2.84 / −1.01 / 2.81.
- `marketData.consistency.test.ts`: new test that `changePercent` and the 52w range of RELIANCE/TCS/INFY agree with their `1d` candles.
**Change requests:** none.
**Rulebook issues found:** none.
**Follow-up tasks created:** none.
