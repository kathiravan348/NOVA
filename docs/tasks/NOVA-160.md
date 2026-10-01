# NOVA-160 — Recorded data history: daily tick summaries + `GET /live/stocks`

**Status:** in-progress · **Owner:** Claude · **Branch:** task/NOVA-160 · **Depends on:** NOVA-155

## Goal
After each session the Atlas worker stores per-day tick summaries; `GET /live/stocks` returns each stock's
days stored, first/last day, gap days, total ticks and size from those summaries only (D80).

## Read first
- `AGENTS.md` (§1 D76: migration and deploy after 15:45 IST); `docs/DECISIONS.md` rows D74, D80
- `backend/services/atlas/src/nova_atlas/{live_storage.py,live.py,worker.py,cli.py}`
- `backend/libs/nova_contracts/src/nova_contracts/live.py`; `frontend/packages/contracts/src/live.ts`

## Files
Create:
- `backend/libs/nova_db/src/nova_db/migrations/versions/rev00NN_tick_summaries.py` (next free number)
- `backend/services/atlas/src/nova_atlas/live_summary.py`, test `backend/services/atlas/tests/test_live_summary.py`
Modify:
- `backend/libs/nova_db/src/nova_db/models/data.py` (+ `models/__init__.py` export lines), `libs/nova_db/tests/test_migrations.py`
- `backend/services/atlas/src/nova_atlas/{worker.py,cli.py,live.py}`, test `tests/test_live.py` (or the existing live API test)
- `backend/libs/nova_contracts/src/nova_contracts/live.py` (+ `__init__.py` export line)
- `frontend/packages/contracts/src/live.ts` + generated `schema/LiveStockHistory.json` (`schema:update`)
- `docs/guides/{API.md,DATABASE.md}`, `docs/CONTRACTS.md`

## Build
1. Tables: `tick_sessions` PK `day` (date): `stocks`, `ticks`, `feed_gap_seconds` (0–22,500), `summarized_at`.
   `tick_days` PK (`exchange`, `symbol`, `day`): `ticks`, `size_bytes`, `seconds_with_tick` (0–22,500). No FK.
2. `live_summary.summarize_day(db, root, day)`: per stock from `ticks` that IST day (count, `sum(pg_column_size)`,
   distinct session seconds); archived stocks from Parquet (`num_rows`, file size, `received_at` in batches).
   `feed_gap_seconds` = 22,500 − distinct session seconds of all stocks. Upsert both tables in one commit.
3. `pending_days(db, root, now)`: recorded days (`live_storage.recorded_days`) with no `tick_sessions` row,
   oldest first; today only from 15:35 IST. `run_worker` gets `summarize: Callable[[Session], None] | None`, called
   in the once-a-minute idle block (one day per call, errors logged, never fatal); `cli.py` passes it.
4. Contract `LiveStockHistory`: `symbol`, `daysStored`, `firstDay`/`lastDay` (null when 0 days), `gapDays`, `tickCount`, `sizeBytes`.
   `gapDays` = summarized days ≥ the stock's first day where it has no `tick_days` row or the session's `feed_gap_seconds > 0`.
5. `GET /live/stocks?symbols=` (1–500, same checks/errors as `/live/snapshot`): one SQL read of the two summary
   tables; stocks never stored → zeros/nulls. No audit write; agents denied like other `/live` reads.

## Acceptance checks
- [ ] Two seeded days (one with a feed gap, one where stock B has no ticks): summaries and `gapDays` as expected.
- [ ] Today is not summarized before 15:35 IST; a second run does nothing; a failure leaves the worker running.
- [ ] Endpoint: 400 for 0 or 501 symbols, 404 unknown stock, zeros for a stock never stored.
- [ ] `docker compose run --rm backend-check` passes; frontend `pnpm typecheck`/`test` pass (contracts).

## Out of scope
- Frontend cards and mocks (NOVA-161); `/live/days` and the archive (NOVA-159) unchanged.
- Deploy (migration) before 15:45 IST on a weekday.

## Questions
_(implementer writes here if blocked)_

## Handoff
_(implementer, ≤ 20 lines — see `docs/templates/HANDOFF.md`)_

## Review
_(reviewer — Claude or ChatGPT, ≤ 20 lines — see `docs/templates/REVIEW.md`)_
