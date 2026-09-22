# NOVA-029 — Market data: contracts, mocks, handlers, services, Orbit browser

**Status:** planned · **Owner:** - · **Branch:** task/NOVA-029 · **Depends on:** NOVA-013, NOVA-028

## Goal
Orbit's `/market-data` shows candles for a chosen instrument and timeframe using `CandlestickChart`, fed through contracts → mocks → MSW → services like every other screen.

## Read first
- `AGENTS.md` (§7), `docs/DECISIONS.md` (D17, D21, D22), `docs/CONTRACTS.md`
- `frontend/packages/contracts/src/{common.ts,index.ts}`, `frontend/packages/mocks/src/{data.ts,handlers/orbit.ts,handlers/scenarios.ts,orbit.consistency.test.ts}`
- `frontend/packages/services/src/{api/orbit.ts,queries/keys.ts,queries/orbit.ts}`
- `frontend/packages/ui-trading/src/components/CandlestickChart/{CandlestickChart.tsx,types.ts}`
- `frontend/apps/nova-orbit/src/{routes.tsx,lib/format.ts,test/renderApp.tsx}`

## Files
Create: contracts `src/marketData.ts`, `src/marketData.test.ts`; mocks `data/instruments.json`, `data/candles.json`, `src/handlers/marketData.ts`, `src/handlers/marketData.test.ts`, `src/marketData.consistency.test.ts`; services `src/api/marketData.ts`, `src/queries/marketData.ts`; orbit `src/pages/market-data/{MarketDataPage.tsx,marketData.test.tsx}`
Modify: contracts `src/index.ts`; mocks `src/data.ts`, `src/handlers/{index.ts,scenarios.ts}`; services `src/index.ts`, `src/queries/keys.ts`, `src/api/api.test.ts`; orbit `src/routes.tsx`; `docs/CONTRACTS.md`

## Build
1. Contracts (strict objects, D17): `InstrumentSchema { symbol, name, exchange, segment, timeframes: Timeframe[] (min 1, unique), dataFrom: IsoDate, dataTo: IsoDate }` (`dataFrom ≤ dataTo`). `CandleSchema { time: string, openPaise, highPaise, lowPaise, closePaise (positive ints), volume (int ≥ 0) }` with `high ≥ max(open, close)`, `low ≤ min(open, close)`, `time` = `IsoDate` or `UtcDateTime`. Schema tests: valid/invalid samples.
2. Mocks: `instruments.json` = RELIANCE, TCS, INFY (NSE, equity_delivery; timeframes `1d` and `5m`). `candles.json` = `{ "<SYMBOL>:<tf>": Candle[] }` with 60 weekday `1d` bars ending 2026-09-18 and 75 `5m` bars for the 2026-09-18 session (03:45Z–09:55Z) per instrument. Hand-generated once with fixed numbers (no runtime maths), times ascending. `data.ts` parses both (`mockInstruments`, `mockCandles`).
3. Consistency test: every key's symbol/timeframe exists in `instruments.json`; `1d` times are `IsoDate` inside `dataFrom..dataTo`; `5m` times are UTC, 5 minutes apart; sorted ascending.
4. Handlers (D21): `GET /market-data/instruments` → list; `GET /market-data/candles?symbol=&timeframe=` → that array; unknown symbol → 404 `not_found`; missing params → 404 `not_found` ("symbol and timeframe are required"); timeframe the instrument lacks → `[]`. Add both to `emptyHandlers`/`errorHandlers`. Handler tests.
5. Services: `listInstruments()`, `listCandles(symbol, timeframe)` (query string via `URLSearchParams`); keys `marketData.instruments`, `marketData.candles(symbol, tf)`; hooks `useInstruments()`, `useCandles(symbol, timeframe)` (`enabled` when both set). Add to `api.test.ts`.
6. `MarketDataPage`: `?symbol=&tf=` in the URL (defaults: first instrument, `1d`). Controls row: instrument `Select`, timeframe `Select` (that instrument's timeframes). `Card` with instrument name + `CandlestickChart` (`ariaLabel` "<SYMBOL> <tf> candles"); `DescriptionList`: Exchange, Segment, Data available (`formatPeriod`), Bars shown. Loading/error/empty via chart props and `QueryError`.
7. Orbit route `/market-data` uses it (replaces the placeholder). Tests (`renderApp`, `vi.mock("lightweight-charts")` not needed: stub `createChart` is not required because jsdom only renders the summary): page shows the RELIANCE summary "60 candles"; switching timeframe to 5m updates the URL and shows "75 candles"; unknown `?symbol=` shows `QueryError`/Not found text.

## Acceptance checks
- [ ] `/market-data` at 360px and desktop, dark/light; chart re-colours on theme switch; times in IST for 5m.
- [ ] `CONTRACTS.md` lists Instrument and Candle; mocks validated by tests.
- [ ] Definition of done in `AGENTS.md` §9.

## Out of scope
- Real downloads (NOVA Atlas, Stage B), indicators, date-range pickers, tick data, options chains.

## Questions

## Handoff

## Review
