# NOVA-137 — Backtest worker no longer freezes on index runs that skip stocks (D68 (4), live bug)

**Status:** planned · **Owner:** Claude · **Branch:** task/NOVA-137 · **Depends on:** 135

## Goal
An index backtest that skips members (NOVA-135) and has a benchmark completes, instead of freezing the
backtest worker and every run queued after it. Found on real data 2026-09-28 (NIFTY 100 runs, NIFTY 50
benchmark): the worker waited for ever on its own row lock.

## Cause
`StrategyEngine.run` sets `run.skipped_symbols` before `save_result`. In `save_result`, `index_closes`
(benchmark) queries the database, SQLAlchemy autoflushes the UPDATE, and the run row is locked in the engine's
open transaction. `progress.stage("saving")` then UPDATEs the same row from its own session (D58) and waits for
that lock; the engine thread waits for the progress write. Tests missed it: their run has no benchmark.

## Read first
- `AGENTS.md`; `docs/DECISIONS.md` D58, D68; every file under Files

## Files
Modify:
- `backend/services/backtest/src/nova_backtest/strategy_engine.py` (`run`)
- `backend/services/backtest/src/nova_backtest/save.py` (`save_result`)
- `backend/services/backtest/tests/test_engine.py`

## Build
1. `save_result` takes `skipped: list[str]` and sets `run.skipped_symbols = skipped` next to
   `run.status = "completed"` (after every progress write). `run` passes `sorted(missing)` and no longer
   assigns the field itself. Nothing else in the engine writes to the run row before the final save.
2. Test: `test_index_runs_skip_members_without_prices` queues its run with `benchmark="NIFTY 50"` and drains
   with a session factory whose connections use `lock_timeout` (e.g. 5 s), so a regression fails fast
   (the progress write errors, the run fails) instead of hanging the test suite.

## Acceptance checks
- [ ] The updated engine test fails on `main` (run failed with a lock timeout) and passes on the branch.
- [ ] Index run with a skipped member and a benchmark: completed, `skipped_symbols` stored, result saved.
- [ ] `docker compose run --rm backend-check` passes.
- [ ] Real data (after rebuild): the NIFTY 100 index runs that froze complete.

## Out of scope
- Progress writer design (D58), the queue, other engine changes, screens. Guides: none (no API/table change).

## Questions
_(implementer writes here if blocked)_

## Handoff
_(implementer writes here)_

## Review
_(reviewer writes here)_
