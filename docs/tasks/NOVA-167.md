# NOVA-167 — Recorded runs: candles built from ticks (D82)

**Status:** planned · **Owner:** — · **Branch:** task/NOVA-167 · **Depends on:** NOVA-166

## Goal
A `recorded` backtest runs on candles built from the recorder's ticks (database, else Parquet archive), on usable
days only, and stores the days it used and skipped. Fills stay as today (NOVA-168 adds bid/ask).

## Read first
- `AGENTS.md` (§1 D76); `docs/DECISIONS.md` rows D49, D61, D77, D80, D82
- `nova_backtest/{columns,strategy_engine,save,settings}.py`; `nova_db/candles.py`; `nova_atlas/archive.py` (layout, `SCHEMA`)
- `nova_db/models/data.py` (`Tick`, `TickSession`, `TickDay`)

## Files
Create:
- `backend/libs/nova_db/src/nova_db/tick_bars.py`, test `backend/libs/nova_db/tests/test_tick_bars.py`
Modify:
- `backend/services/backtest/src/nova_backtest/{columns,strategy_engine,save,settings}.py`, tests `test_engine.py`, `test_worker.py`
- `backend/services/backtest/pyproject.toml` (`pyarrow` at the exact pin Atlas uses), `backend/uv.lock`
- `compose.yaml` (`backtest-worker`: `tick-archive:/archive:ro`, `NOVA_ARCHIVE_DIR: /archive`)
- `docs/guides/USER-GUIDE.md` (known limits line only), `docs/guides/API.md` (run fields filled by the worker)

## Build
1. `tick_bars.usable_days(db, exchange, symbols, start_day, end_day) -> (used: dict[symbol, list[date]], skipped: list[date])`:
   sessions in the period with `feed_gap_seconds ≤ 300` (`RECORDED_MAX_GAP_SECONDS`) are used, the others are
   skipped; a stock uses a used day only if it has a `tick_days` row. Days without a `tick_sessions` row (today
   before the summary) are neither used nor listed.
2. `tick_bars.read_tick_bars(db, archive_root, exchange, symbol, width_seconds, day) -> list[BarRow]` (same
   `BarRow` as `candles.read_bars`): database first, SQL bucketing by `exchange_ts` (`time_bucket` with origin
   09:15 IST, `first`/`last` by `exchange_ts`, rows with null `exchange_ts` skipped, 09:15:00 ≤ t < 15:30:00 IST).
   No rows → the archive file `date=…/symbol=…/ticks.parquet` with the same rules in pyarrow/numpy; no file → `[]`.
   Bar volume = the day volume at the bar's last tick − at the previous bar's last tick (first bar: − 0).
3. Widths: `1s 5s 15s 30s` and `1m 3m 5m 15m 30m 1h` (one helper `timeframe_seconds`, also used where the engine
   needs the bar size, e.g. opening range).
4. Engine: for `data_source == "recorded"`, pass 1 loads each stock day by day from `usable_days` (warm-up = used
   days inside the usual warm-up span) into `Columns`; the bar caps (D61) still apply. No used day at all → fail
   "No usable recorded days in this period". `save` writes `recorded_days_used` (count of used sessions) and
   `recorded_days_skipped`. History runs take the exact same code path as before.
5. USER-GUIDE known limits: recorded backtests start on 1 Oct 2026; days with feed gaps over 5 minutes are skipped.

## Acceptance checks
- [ ] Seeded ticks: 1s and 1m bars have the right OHLC and volume; ticks at 09:14:59 and 15:30:00 are excluded;
      a null `exchange_ts` row is ignored; a second without a tick has no bar.
- [ ] Same day from a Parquet file gives the same bars as from the database.
- [ ] A 400 s feed-gap day is skipped and listed; a stock missing from `tick_days` that day gets no bars.
- [ ] A recorded intraday run completes end to end; every existing history engine test passes unchanged.
- [ ] `docker compose run --rm backend-check`. Deploy: `docker compose up -d --build --no-deps backtest-worker`.

## Out of scope
- Bid/ask fills and spread cost (168), screens (169), market filter on recorded data, the jump-ahead simulator.

## Questions

## Handoff
