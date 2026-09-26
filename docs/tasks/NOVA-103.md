# NOVA-103 — Backtest worker: no stuck runs, restart after a crash, bar limit (D59)

**Status:** planned · **Owner:** — · **Branch:** task/NOVA-103 · **Depends on:** —

## Goal
A worker crash (e.g. out of memory) can no longer leave a run stuck in `running`, the worker comes back by
itself, and a run too big for it fails early with a plain message (D59). Live bug 26 Sep: a 49-stock,
9-month 1m Python run (~3.8 M bars) was OOM-killed at 512 MB.

## Read first
- `AGENTS.md`; `docs/DECISIONS.md` D59; every file under Files (read only the sections named)

## Files
Modify:
- `backend/libs/nova_db/src/nova_db/queue.py` (add `fail_running`), `backend/libs/nova_db/tests/test_queue.py`
- `backend/services/backtest/src/nova_backtest/{worker,strategy_engine,settings,cli}.py`
- `backend/services/backtest/tests/{test_worker,test_engine}.py`
- `compose.yaml` (`backtest-worker` only)
- `docs/guides/USER-GUIDE.md` (§7 "what do I do if" rows)

## Build
1. `queue.py`: `fail_running(db, table, message, condition=None) -> int` sets leftover `running` rows to
   `failed`, `error=message`, `finished_at=now()`, returns the count. Keep `requeue_running` (Atlas uses it).
2. `worker.py`: on start call `fail_running` instead of `requeue_running`, message:
   "The backtest worker stopped during this run (often: not enough memory). Run it again; if it stops
   again, pick fewer stocks or a shorter period." Log the count. A requeue would re-run the same OOM forever.
3. `settings.py`: `backtest_max_bars: int = Field(1_500_000, gt=0)` (env `NOVA_BACKTEST_MAX_BARS`; no
   `.env`/compose wiring needed, the default is the setting).
4. `strategy_engine.py`: replace the `bars = {…}` comprehension with a loop that loads one symbol at a
   time, keeps a running total (warm-up bars included) and, as soon as it passes `max_bars`, raises
   `EngineError`: "This run needs more than {max_bars:,} price bars (stopped at {symbol}). Pick fewer
   stocks or a shorter period." Pass the limit into `StrategyEngine(max_bars=…)` from `cli.default_engine` via settings; tests pass a small number. Do not change `_bars` itself (NOVA-100 rewrites it).
5. `compose.yaml` `backtest-worker`: `mem_limit: 1536m`, `restart: unless-stopped`, comment citing D59.
6. Measure: on the running stack, run the Python-mode "RSI(14) pullback" strategy (1m, intraday) on
   enough stocks/months to load ~1.4 M bars; note peak `docker stats nova-backtest-worker` memory in the
   handoff. Must stay under ~1.2 GB, else lower the default until it does.
7. USER-GUIDE §7 rows: "Backtest *Failed*: needs more than … price bars" → fewer stocks / shorter period
   (1-minute bars add up fast); "…worker stopped during this run" → run again, then smaller. "State as of".

## Acceptance checks
- [ ] Test: a run left `running` becomes `failed` with the message on worker start; `queued` runs untouched.
- [ ] Test: `fail_running` honours `condition`; `requeue_running` behaviour and tests unchanged.
- [ ] Test: with `max_bars` below the data size the run fails with the message, no trades/result rows;
      at or above it the existing engine tests still pass.
- [ ] `docker compose up -d backtest-worker`; `docker kill nova-backtest-worker` mid-run → container
      restarts by itself and the run shows **Failed** with the stopped message in Orbit.
- [ ] Measured peak memory at the default limit written in the handoff.
- [ ] Definition of done in `AGENTS.md` §9 (`docker compose run --rm backend-check`).

## Out of scope
- Making the engine use less memory per bar (columnar bars, streaming the Python sandbox): a later task.
- Progress (NOVA-101/102), roll-ups (NOVA-100), Atlas worker, frontend code, automatic retries.

## Questions
_(implementer writes here if blocked)_

## Handoff
_(implementer, ≤ 20 lines — see `docs/templates/HANDOFF.md`)_

## Review
_(Claude, ≤ 20 lines — see `docs/templates/REVIEW.md`)_
