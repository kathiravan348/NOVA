# NOVA-164 — Daily Kite check of recorded ticks + `GET /live/checks`

**Status:** done · **Owner:** Claude · **Branch:** task/NOVA-164 · **Depends on:** —

## Goal
After each recorded day the Atlas worker compares 50 stocks' ticks with Kite's 1-minute candles, stores one
`tick_checks` row per day and serves the results on `GET /live/checks` (D81 item 4).

## Read first
- `AGENTS.md` (§1 D76); `docs/DECISIONS.md` rows D80, D81; `nova_atlas/{live_summary,worker,cli,live,broker_client}.py`
- `backend/libs/nova_contracts/src/nova_contracts/live.py`; `frontend/packages/contracts/src/live.ts`

## Files
Create:
- `backend/libs/nova_db/src/nova_db/migrations/versions/rev0027_tick_checks.py`
- `backend/services/atlas/src/nova_atlas/live_check.py`, test `backend/services/atlas/tests/test_live_check.py`
Modify:
- `backend/libs/nova_db/src/nova_db/models/data.py` (+ `models/__init__.py` export lines), `libs/nova_db/tests/test_migrations.py`
- `backend/services/atlas/src/nova_atlas/{worker.py,cli.py,live.py}`, tests `test_queue_worker.py`, `test_live.py`
- `backend/libs/nova_contracts/src/nova_contracts/live.py` (+ `__init__.py` export lines)
- `frontend/packages/contracts/src/live.ts` + generated `schema/TickCheck.json` (`schema:update`)
- `docs/guides/{API.md,DATABASE.md}`, `docs/CONTRACTS.md`

## Build
1. Table `tick_checks`, PK `day`: `stocks_checked`, `stocks_skipped`, `minutes`, `close_matches`, `range_ok`,
   `volume_matches` (ints ≥ 0), `clock_offset_ms` (bigint, null), `stocks` (jsonb per-stock counts), `checked_at`.
2. `live_check.check_day(db, broker, day)`: sample from `tick_days` that day (≥ 200 ticks, symbol not ending in
   `INAV`): 10 busiest + 40 random (`random.Random(day.isoformat())`). Per stock: `broker.historical(token,
   "minute", 09:15, 15:30 IST)`; no candles → skipped. One indexed read of its ticks (`exchange_ts` or
   `received_at`, `last_price_paise`, `volume`); bucket by exchange-time IST minute. Compare minutes from 09:16 to
   Kite's last candle that we also have: close equal; our high ≤ Kite high and low ≥ Kite low; volume equal
   (our end-of-minute `volume` − the previous minute's, only when we have that minute).
   `clock_offset_ms` = median `received_at − exchange_ts` over the sample (SQL `percentile_cont`). Upsert the row.
3. `check_next(db, broker, now)`: oldest day with a `tick_sessions` row, no `tick_checks` row and within 10 days;
   today only from 16:00 IST; one day per call. A `BrokerDataError` (e.g. Kite not logged in) is logged and the
   next try waits 15 min. `run_worker` gets `check: Callable[[Session], object] | None`, run after `summarize` in
   the once-a-minute idle block (errors logged, never fatal); `cli.py` passes it.
4. Contract `TickCheck`: `day`, `stocksChecked`, `stocksSkipped`, `minutes`, `closeMatchPercent`,
   `rangeOkPercent`, `volumeMatchPercent` (1 decimal), `clockOffsetSeconds` (null), `warnings: string[]`,
   `checkedAt`, `stocks` (`symbol`, `minutes`, the three percents). Warnings: close < 95 %, range < 99 %,
   volume < 95 %, |clock offset| > 3 s ("Receive times are 16 s off exchange times: sync the PC clock"),
   skipped > 10.
5. `GET /live/checks?limit=` (1–60, default 10), newest first, one read; agents denied like other `/live` reads.

## Acceptance checks
- [ ] Seeded ticks + fake broker: matching minutes count as matches; a wrong close, a high above Kite's and a wrong
      volume each count once; a stock with no candles is skipped; a 16 s receive delay gives the clock warning.
- [ ] `check_next`: today not before 16:00 IST; a checked day is not checked again; a broker error waits 15 min.
- [ ] `GET /live/checks` returns percents and warnings; 400 for `limit=0` (the app maps validation errors to 400); agent denied.
- [ ] Migration up/down test; Definition of done in `AGENTS.md` §9 (`docker compose run --rm backend-check`).
- [ ] Deploy (D76) after 15:45 IST or at a weekend: `docker compose run --rm --no-deps migrate`, then
      `docker compose up -d --build --no-deps atlas atlas-worker`.

## Out of scope
- Screens (NOVA-165), alerts, re-running a check from the UI, archived (Parquet) days, day candles.

## Questions

## Handoff
- Built by Claude, 3 Oct 2026. `nova_atlas/live_check.py`: `sample` (10 busiest + 40 seeded-random, ≥ 200 ticks,
  no iNAVs), `compare`, `check_day` (upsert), `next_day`, `DailyCheck.check_next` (15 min wait after a
  `BrokerDataError`), `warnings`, `contract`. Worker `check=` runs after `summarize`; `cli.py` wires it.
- Added column `volume_minutes` (not in the task text): volume can only be compared when the previous minute was
  recorded, so the volume percent uses its own denominator instead of counting those minutes as misses.
- Ticks are bucketed by `COALESCE(exchange_ts, received_at)` per IST minute; Kite rows parsed like downloads.
- `GET /live/checks?limit=1–60` (bad limit → 400, the app's validation status). Agents: `live` area is blocked in
  `agent_rules.py`, so no new rule was needed.
- Mock `frontend/packages/mocks/data/liveChecks.json` created here (needed by the parity test); NOVA-165 wires it
  into services and handlers.
- Checks: backend-check 1,354 passed; contracts + mocks tests, lint, typecheck, format pass.
- Guides: API, DATABASE (migration 0027), CONTRACTS.

## Review
Self-review: yes (Owner allowed self-review on 3 Oct 2026). Matches the task plus `volume_minutes`. Deployed
Saturday 3 Oct 2026: `migrate`, then `atlas atlas-worker` with `--no-deps`. Verdict: done.
