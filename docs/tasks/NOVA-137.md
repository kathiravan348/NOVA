# NOVA-137 — Backtest worker no longer freezes on index runs that skip stocks (D68 (4), live bug)

**Status:** done · **Owner:** Claude · **Branch:** task/NOVA-137 · **Depends on:** 135

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
- [x] The updated engine test fails on `main` (run failed with a lock timeout) and passes on the branch.
- [x] Index run with a skipped member and a benchmark: completed, `skipped_symbols` stored, result saved.
- [x] `docker compose run --rm backend-check` passes.
- [x] Real data (after rebuild): the NIFTY 100 index runs that froze complete.

## Out of scope
- Progress writer design (D58), the queue, other engine changes, screens. Guides: none (no API/table change).

## Questions
_(implementer writes here if blocked)_

## Handoff
**Done:** `save_result` takes `skipped` and stores it with `completed`, after the last progress write;
`StrategyEngine.run` no longer touches the run row.
**Files changed:** the three under Files, plus this task and BOARD.md.
**Commands run:** the engine test on unfixed code: `LockNotAvailable` on the `saving` progress UPDATE (reproduced);
backend-check (ruff, format, mypy, 1,203 tests): pass.
**Checked:** 360px / desktop / dark / light: N/A (no screens). **New dependencies:** none.
**Maps updated:** none. **Guides:** none (no API, table or screen change).
**Deviations from task:** none.
**Known gaps:** real-data check after the rebuild (acceptance item 4) is done by the reviewer.

## Review
**Result:** done
**Reviewer / built by:** Claude / Claude. **Self-review:** yes (Owner allowed; same session, not a fresh one).
**Fixed directly (review: commits):** none.
**Checked:** no other write to the run row before the final save on the visual, rotation and Python paths;
the failure path rolls back before `fail_run`. Real data after rebuilding the backtest services: the 4 frozen
NIFTY 100 runs (skipping BAJAJ-AUTO, ENRIN, HYUNDAI, TATACAP, TMCV) and a NIFTY 50 intraday run completed in
2-3 s; totals, charges, bySymbol and every fill vs the bar's low-high checked independently.
**Change requests (if sent back):** none.
**Guides checked:** not affected. **Rulebook issues found:** none. **Follow-up tasks created:** none.
