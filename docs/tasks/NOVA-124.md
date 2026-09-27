# NOVA-124 — Atlas: `candle_days` summary, trading calendar, coverage endpoints (D63, migration 0017)

**Status:** planned · **Owner:** — · **Branch:** task/NOVA-124 · **Depends on:** NOVA-112, NOVA-113, NOVA-123

## Goal
A per-day candle summary is always current: filled once by the migration, then updated by every download step and job delete.
From it, `GET /market-data/coverage` and `/coverage/{symbol}` answer instantly with first and last days, missing trading days
and a status per stock (D63 (1)–(3)).

## Read first
- `AGENTS.md`; `docs/DECISIONS.md` D41, D56, D57, D58, D63; `docs/guides/DATABASE.md` (candles); every file under Files

## Files
Create:
- `backend/libs/nova_db/src/nova_db/migrations/versions/rev0017_candle_days.py`, `backend/libs/nova_db/src/nova_db/models/coverage.py`
- `backend/services/atlas/src/nova_atlas/coverage.py`, `backend/services/atlas/tests/test_coverage.py`
Modify:
- `backend/libs/nova_db/src/nova_db/models/__init__.py`, `backend/services/atlas/src/nova_atlas/{download,job_control,main}.py`
- `backend/services/atlas/tests/{test_download,test_job_delete}.py`, `docs/guides/{DATABASE,API}.md`

## Build
1. Migration 0017 creates `candle_days`:
   - Columns: `exchange`, `symbol`, `timeframe` (check `1m`/`1d`), `day` (IST date), `bars` (int > 0).
   - PK (`exchange`, `symbol`, `timeframe`, `day`).
   - Fill it with `INSERT … SELECT … GROUP BY` over `candles` for `1m`/`1d`, using the IST date of `ts`.
   - The downgrade drops the table. Note the fill time on the Owner DB in the handoff (about 12 s expected).
2. `coverage.recount_days(db, exchange, symbol, timeframe, start, end)` deletes that range's rows and inserts fresh counts
   from `candles`, in the caller's transaction.
   - `download.run_download` calls it right after each step's `upsert_candles`, for that step's range.
   - `job_control._delete_candles` calls it for the job's symbols and period after deleting.
3. `coverage.calendar(db, exchange, from, to)` returns the trading days:
   - the NIFTY 50 `1d` days in `candle_days` when any exist in the range (`calendar = "index"`)
   - otherwise the days on which at least 10 symbols have `1d` rows (`"stocks"`).
4. `GET /market-data/coverage?timeframe=1d|1m&from&to`:
   - Defaults: `to` = today (IST), `from` = `to` − 5 years; `from` must not be after `to`, else 400.
   - Rows: every `universe` stock (name, sector, indices), plus each `market_indices` name with rows in `candle_days`
     (kind `index`, sector "Index").
   - Per row, from `candle_days`:
     - `firstDay`/`lastDay`: the whole stored range.
     - Missing days: calendar days in [max(firstDay, from), min(lastDay, to)] with no row.
     - `partial` when it starts after the first calendar day of the period or ends before the last one.
   - One SQL pass; no per-stock queries.
5. `GET /market-data/coverage/{symbol}?timeframe&from&to` gives the same numbers plus the missing days merged into ranges
   (calendar-consecutive days = one range). Unknown symbol → 404.
6. Register the router. API: two rows. DATABASE: the table, how it stays current, migration header. "State as of" in both.

## Acceptance checks
- [ ] Migration test: after upgrade, `candle_days` equals a fresh aggregate of the test candles; downgrade/upgrade works.
- [ ] Download test: a completed step adds its days. Re-running with overwrite keeps counts right. Deleting a job with
      candles removes its days.
- [ ] Coverage tests:
  - the calendar comes from the index when present, else from stocks
  - a 3-day hole is 3 missing days and one range
  - a later listing is `partial` with 0 missing
  - no rows is `none`
  - period clipping works
- [ ] On the Owner DB (~2,500 stocks), `GET /market-data/coverage?timeframe=1m` answers in < 1 s (time it in the handoff).
- [ ] `docker compose run --rm backend-check` passes.

## Out of scope
- The Relay page (NOVA-126); half-day or short-session detection; tick coverage; changing downloads or plans otherwise.

## Questions
_(implementer writes here if blocked)_

## Handoff
_(implementer, ≤ 20 lines — see `docs/templates/HANDOFF.md`)_

## Review
_(Claude, ≤ 20 lines — see `docs/templates/REVIEW.md`)_
