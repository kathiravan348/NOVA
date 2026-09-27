# NOVA-110 — Engine: two-pass streaming simulator on scratch memmaps; sells before buys (D61)

**Status:** planned · **Owner:** — · **Branch:** task/NOVA-110 · **Depends on:** NOVA-109

## Goal
Step 2 of the streaming engine (D61 (3), (4)). Pass 1 writes each stock's columns and signal arrays to a per-run scratch
folder. Pass 2 simulates all stocks in time order, reading them chunk by chunk, so memory stays flat whatever the period.
At each bar time: sells → buys → adds, stops, targets → signals. `Bar` lists are no longer built for the simulator.

## Read first
- `AGENTS.md`; `docs/DECISIONS.md` D45, D46, D53, D58, D59, D61; every file under Files

## Files
Create:
- `backend/services/backtest/src/nova_backtest/{scratch,book,timeline}.py`
- `backend/services/backtest/tests/{test_scratch,test_timeline}.py`, `backend/services/backtest/tests/reference_simulate.py`
Modify:
- `backend/services/backtest/src/nova_backtest/{simulate,strategy_engine,worker,settings}.py`
- `backend/services/backtest/tests/{test_simulate,test_engine,test_worker}.py`

## Build
1. `settings.py`: `backtest_scratch_dir: Path = Path("/tmp/nova-backtest")` (env `NOVA_BACKTEST_SCRATCH_DIR`).
2. `scratch.py`: `RunScratch(root, run_id)` with `add(symbol, columns, enter, exit_)`, which saves `.npy` files per symbol,
   and `open(symbol)`, which loads them with `mmap_mode="r"`. Also `symbols()`, `close()` (removes the folder, also on
   failure) and `clear_all(root)`. `worker.py` calls `clear_all` on start, next to `fail_running`.
3. `book.py`: move `ClosedTrade`, `_Position` (as `Position`), cash, `worth()`, buy, close and average-down out of
   `simulate.py` unchanged.
4. `timeline.py`: walks all symbols' `ts` memmaps in time order, one window of about 500 k bars at a time. It yields
   `(ts, [(symbol, index), …])` groups in symbol order and gives the window's OHLC as Python lists, for speed.
   It keeps each symbol's previous bar across windows, for the intraday day-change rule.
5. `simulate.py` walks the timeline. At each bar time:
   - **a.** Day change, then the square-off rules (D46). Pending **exits** fill at the open.
   - **b.** Pending **entries** fill at the open, in symbol order. Each is sized on `worth()` using every holding's
     **previous** close.
   - **c.** For each holding: averaging adds, then stop, then target (D45, D53), exactly as today.
   - **d.** Update `last_close`, then read `enter`/`exit` at the close into pending orders.
   - The equity point is taken at each IST day change, as today; `on_bar` progress also as today.
6. `strategy_engine.py`:
   - Pass 1, per stock: `Columns.load` → signals (visual; Python keeps its NOVA-109 path) → `scratch.add` → free.
   - Pass 2: `simulate(scratch, …)`. Progress stages: `loading` = pass 1, `simulating` = pass 2.
   - The bar-limit check stays as it is (NOVA-111 re-measures it). `finally: scratch.close()`.
7. `reference_simulate.py`: today's `simulate.py` over in-memory `Bar` lists, changed only to group events by `ts` and run
   steps a–d. It is the oracle for the random tests.

## Acceptance checks
- [ ] Random differential test: 200 seeded cases (1–6 symbols, daily and 1m-style intraday bars, missing bars, gaps, averaging
      on/off, stop/target on/off, cash-limited sizing). `simulate` over scratch memmaps, run with a tiny window (7 bars)
      so chunk edges are crossed, gives the same trades and equity as `reference_simulate`.
- [ ] Existing simulate/engine tests pass. Any expected value that changes only because of the D61 order is updated,
      with a one-line comment naming D61 (list them in the handoff).
- [ ] The scratch folder is gone after a completed run, after a failed run, and after a worker restart.
- [ ] Measured with a bench script on the Owner stack, calling the engine directly: 100 synthetic stocks × 5 years of 15m bars
      (≈ 3.2 M bars). Peak RSS < 600 MB. Write the peak and the time in the handoff.
- [ ] `docker compose run --rm backend-check` passes. Guides: none.

## Out of scope
- Python mode per stock and bar limits (NOVA-111); ranking and max positions (NOVA-115); jump-ahead / seconds (D61 (7)).

## Questions
_(implementer writes here if blocked)_

## Handoff
_(implementer, ≤ 20 lines — see `docs/templates/HANDOFF.md`)_

## Review
_(Claude, ≤ 20 lines — see `docs/templates/REVIEW.md`)_
