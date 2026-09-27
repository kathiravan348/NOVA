# NOVA-111 — Engine: Python strategies one stock at a time; limits re-measured (D61)

**Status:** planned · **Owner:** — · **Branch:** task/NOVA-111 · **Depends on:** NOVA-110

## Goal
Step 3 of the streaming engine (D61 (5), (6)). Python strategies run in one sandbox process per stock, so memory no longer
grows with the number of stocks. The D59 bar caps are re-measured and become run-time guards. After this task, 15m and 1m
NIFTY 100 × 5-year runs are allowed.

## Read first
- `AGENTS.md`; `docs/DECISIONS.md` D47, D51, D59, D61; every file under Files

## Files
Modify:
- `backend/services/backtest/src/nova_backtest/{sandbox,strategy_engine,settings,progress}.py`
- `backend/services/backtest/tests/{test_sandbox,test_engine,test_progress}.py`
- `docs/guides/USER-GUIDE.md` (§7 rows about bar limits). Claude copies the measured numbers into D61 during review.
Delete:
- `backend/services/backtest/tests/reference_rules.py` (NOVA-109's reference; move any still-useful case into `test_rules.py`)

## Build
1. `sandbox.py`: `run_python_one(code, symbol, columns) -> npt.NDArray[np.int8]` (0 none, 1 enter, 2 exit). It is today's
   `run_python` for one stock: the same AST check (done once per run, not per stock), child process, limits and timeout
   **per stock**, and indicators computed from `columns`. Keep `run_python` only if a test still needs it.
2. `strategy_engine.py`, pass 1 in Python mode: per stock, `Columns.load` → `run_python_one` → turn the codes into the
   `enter`/`exit` arrays → `scratch.add`. Error messages name the stock: "Python strategy error in RELIANCE: …".
3. `progress.py`: stage `signals` counts stocks done in both modes. `loading` is only the first stock's read, or drop it
   from pass 1 if simpler (keep the stage names in the contract unchanged).
4. Limits. Measure on the Owner stack with bench scripts, and write the results in the handoff:
   - Visual: NIFTY 100 × 5 years of 1d, 15m and 1m-size synthetic bars (≈ 0.15 M / 3.2 M / 47 M).
   - Python: 1d and 15m.

   Then set the defaults so the largest run finishes in **≤ 15 minutes** with peak RSS < 1 GB:
   - `backtest_max_bars` (expected about 50 M)
   - `backtest_max_bars_python` (expected about 5 M)

   The message stays: "This run needs more than … price bars … Pick fewer stocks or a shorter period."
5. USER-GUIDE §7: update the bar-limit row with the new sizes, in plain words (e.g. "about 100 stocks × 5 years of 1-minute
   bars for visual strategies"). Update "State as of".

## Acceptance checks
- [ ] Python engine tests pass with unchanged expected values. A stock's code error fails the run and names the stock.
- [ ] A Python run over 3 stocks starts 3 sandbox processes (test with a spy), each within its own limits.
- [ ] Measurements and new defaults are in the handoff. Peak RSS < 1 GB and time ≤ 15 min at each default.
- [ ] `docker compose run --rm backend-check` passes; `reference_rules.py` deleted.

## Out of scope
- New spec features (NOVA-115–117); a jump-ahead simulator and seconds bars (D61 (7)); frontend.

## Questions
_(implementer writes here if blocked)_

## Handoff
_(implementer, ≤ 20 lines — see `docs/templates/HANDOFF.md`)_

## Review
_(Claude, ≤ 20 lines — see `docs/templates/REVIEW.md`)_
