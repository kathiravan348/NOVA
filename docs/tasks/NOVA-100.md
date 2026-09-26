# NOVA-100 — Download 1m and 1d only; build 3m–1h candles from 1m

**Status:** planned · **Owner:** — · **Branch:** task/NOVA-100 · **Depends on:** NOVA-099, NOVA-103

## Goal
New downloads accept only `1m` and `1d` (D58). Charts, instrument coverage and backtests get `3m 5m 15m 30m 1h`
by rolling up stored 1m bars at read time, with buckets starting at 09:15 IST like Kite's own candles.

## Read first
- `AGENTS.md`; `docs/DECISIONS.md` D58
- `backend/services/atlas/src/nova_atlas/market_data.py`, `plan.py` (`check_request`), `tests/test_market_data.py`, `tests/test_plan.py`
- `backend/services/backtest/src/nova_backtest/strategy_engine.py` (`_bars`), `tests/test_engine.py`
- `frontend/apps/nova-relay/src/pages/data-jobs/NewDownloadPage.tsx`, `dataJobs.test.tsx`

## Files
Create:
- `backend/libs/nova_db/src/nova_db/candles.py`, `backend/libs/nova_db/tests/test_candles.py`
Modify:
- `backend/libs/nova_db/src/nova_db/enums.py` (add `DOWNLOAD_TIMEFRAMES = ("1m", "1d")`)
- `backend/services/atlas/src/nova_atlas/market_data.py`, `plan.py`, `tests/test_market_data.py`, `tests/test_plan.py`
- `backend/services/backtest/src/nova_backtest/strategy_engine.py`, `tests/test_engine.py`
- `frontend/apps/nova-relay/src/pages/data-jobs/NewDownloadPage.tsx`, `dataJobs.test.tsx`
- `docs/guides/API.md` (`/market-data/candles`, `/market-data/instruments`, `POST /data-jobs`, plan), `docs/guides/USER-GUIDE.md`

## Build
1. `nova_db/candles.py`: `read_bars(db, exchange, symbol, timeframe, start, end) -> list[BarRow]`
   (`BarRow` = frozen dataclass `ts, open_paise, high_paise, low_paise, close_paise, volume`).
   `1m`/`1d`: stored rows, ordered by `ts`. `3m 5m 15m 30m 1h`: one SQL over the `1m` rows,
   `time_bucket(<interval>, ts, origin => '2000-01-03 03:45:00+00')` (= 09:15 IST), `first(open_paise, ts)`,
   `max(high)`, `min(low)`, `last(close_paise, ts)`, `sum(volume)`, grouped and ordered by bucket.
   A bucket's `ts` is its start. The last bucket of a day can be short (e.g. 1h 15:15–15:30), as on Kite.
   Stored `3m`–`1h` rows are never read again.
2. `strategy_engine._bars` and `market_data.list_candles` call `read_bars` (same response shape as today).
3. `build_instruments` coverage: `3m`–`1h` entries are copies of the stock's `1m` range (only when it has 1m);
   stored `3m`–`1h` rows are ignored. `timeframes` follows the same rule. Intraday price stats use 1m.
4. `check_request`: timeframe must be in `DOWNLOAD_TIMEFRAMES`, else
   `ValueError("Download 1m or 1d; 3m to 1h are built from 1m")` (API answers 400). Old jobs are untouched.
5. Relay **New download**: the **Timeframe** select offers only **1 minute** and **1 day** (default 1 day).
6. USER-GUIDE: downloads are 1 minute or 1 day; other candle sizes are made from 1-minute data, so download
   1 minute to test 5-minute strategies. API.md: note the roll-up and the 400.

## Acceptance checks
- [ ] pytest `test_candles.py`: 1m bars 09:15–09:29 → three 5m bars (09:15, 09:20, 09:25) with correct O/H/L/C/V;
      1h buckets start 09:15, 10:15 … 15:15; a day with missing minutes still rolls up; `1d` returns stored rows.
- [ ] pytest: a 5m strategy backtests on a stock that has only 1m data; coverage lists 5m for a 1m-only stock;
      `POST /data-jobs` and the plan endpoint answer 400 for `5m`.
- [ ] Vitest: the Timeframe select has exactly 1 minute and 1 day.
- [ ] Owner stack: Market data chart at 5m and 1h for a stock with 1m data matches Kite's chart for one day.
- [ ] Definition of done in `AGENTS.md` §9.

## Out of scope
- New timeframes (10m, 2h …): the `Timeframe` contract stays `1m 3m 5m 15m 30m 1h 1d`.
- Building `1d` from 1m (NSE's official close is not the last 1m close). Deleting old 3m–1h rows (Owner uses **Delete job**).
- Caching or storing rolled-up bars.

## Questions

## Handoff

## Review
