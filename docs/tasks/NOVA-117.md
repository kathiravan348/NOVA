# NOVA-117 — Engine: market filter (regime) + rotation mode (D62)

**Status:** done · **Owner:** Claude · **Branch:** task/NOVA-117 · **Depends on:** NOVA-116, NOVA-127

## Goal
Backtests honour `regime` on visual and Python specs and run `mode: "rotation"` specs (D62 (3), (4)). After this task every
field NOVA-114 added is executed. Momentum rotation (library family A) can be tested.

## Read first
- `AGENTS.md`; `docs/DECISIONS.md` D45, D61, D62; `docs/STRATEGY-LIBRARY.md` §2–3; every file under Files

## Files
Create:
- `backend/services/backtest/src/nova_backtest/{regime,rotation}.py`
- `backend/services/backtest/tests/{test_regime,test_rotation}.py`
Modify:
- `backend/services/backtest/src/nova_backtest/{simulate,strategy_engine,scratch}.py`
- `backend/services/backtest/tests/test_engine.py`

## Build
1. `regime.py`:
   - Load the index's columns (`symbol` = index name) in the strategy's timeframe; intraday ones are rolled up from index 1m.
   - Evaluate the condition with the NOVA-109 rule code, giving one bool per index bar.
   - `on_at(ts)` = the value of the last index bar at or before `ts`.
   - No index candles in the period → `EngineError`: "No {index} {timeframe} prices for this period: download them in Relay
     (Stored data → Download missing)".
2. `simulate.py`, regime:
   - `no_new_entries`: a buy waiting from a signal bar where the regime was off is dropped.
   - `exit_all`: at a close where the regime is off, queue sells for every holding. No buys while it is off.
3. `rotation.py` + pass 1:
   - Per stock, save `score` (the weighted sum of the terms; NaN if any term is NaN) and `eligible` (the filter; all true when
     there is no filter) to scratch.
   - The rebalance bars are the first bar on or after the start, and the first bar of each new ISO week, month or quarter
     (IST dates). The decision uses each stock's **previous** bar values and fills at the open of that rebalance bar. This is
     the same as "decide at the last close of the period, fill at the next open".
4. At a rebalance bar T:
   - **Ranking:** rank stocks that have a bar at T, are eligible, and have a score, from high to low.
   - **Sells:** step a sells holdings whose rank > `keepWithin` or that are no longer eligible. A holding without a bar at T is kept.
   - **Buys:** step b buys the best-ranked stocks not held until there are `hold` holdings. Each gets `worth() ÷ hold`, using
     previous closes, in whole shares at the open, capped by cash.
   - **Market filter:** with `exit_all` off → sell everything and buy nothing. With `no_new_entries` off → sells as usual, no buys.
   - **Filter back on:** when the regime turns from off to on, the next bar is a rebalance bar.
   - **Between rebalances:** stop-loss, trailing and ATR stops apply. A stopped stock can be bought again at the next rebalance.
5. `strategy_engine.py`: remove NOVA-115's "not supported yet" guard. Add the rotation branch; it accepts only `equity_delivery` + `1d` (the contract already enforces this),
   and progress and results work as for other modes.

## Acceptance checks
- [ ] Hand-made 6-stock daily fixture, monthly hold 2 keep 3:
  - trades happen exactly on the first bar of each month
  - a stock that drops to rank 3 is kept, one at rank 4 is sold
  - equal ₹ per buy
  - the filter excludes a stock
  - a weekly run and a quarterly run rebalance on the right bars
- [ ] Regime:
  - `exit_all` sells everything at the open after the index closes below its SMA, then buys again after it recovers
  - `no_new_entries` keeps holdings
  - a missing index gives the message above
- [ ] Engine test: rotation A01 settings on 30 synthetic stocks for 2 years complete with years and metrics filled; every older
      test passes unchanged.
- [ ] `docker compose run --rm backend-check` passes. Guides: none (the editor and guide come in NOVA-118/119).

## Out of scope
- Editor (NOVA-118/119); weights other than equal; top-ups and trims; jump-ahead (D61 (7)).

## Questions
_(implementer writes here if blocked)_

## Handoff
Done. `regime.py`: `load_regime` reads the index like a stock in the strategy's timeframe (warm-up included) and
evaluates the condition with the array rule code; `RegimeSeries.at(ts)` = last index bar at or before (off before the
first); no index bars in the period → "No NIFTY 50 1d prices for this period: download them in Relay (Stored data →
Download missing)". Pass 1 stores each stock's filter per bar (`regime` array in scratch, `BarAt.regime`).
`simulate.py`: no buy is queued at a close where the filter is off; `exit_all` also queues a sell of every holding
there. The loop is now `run_loop(store, Run, …)` with `warm_up` and `begin` hooks. `rotation.py`: pass 1 saves the score
(weighted sum, NaN if a term is NaN) and the filter; `RotationRun` rebalances on the first bar time on/after the start,
each new ISO week/month/quarter, and the bar time after the market filter comes back on; ranks on each stock's
previous close; sells rank > keepWithin or filtered out (a holding without a bar is kept); buys best not held up to
`hold`, worth ÷ hold each at the open, capped by cash; no buys while off; stops, target and bars-held exits apply.
`strategy_engine.py`: guard removed; rotation branch; results writing moved to `save.py` (keeps files ≤ 300 lines).
- Tests: `test_rotation.py` (6 stocks monthly hold 2 keep 3: trades only on first bars of months, rank 3 kept, rank 4
  sold, 50 shares each, filtered-out leader skipped; weekly on Mondays; quarterly on 1 Jan/1 Apr/1 Jul; `exit_all` sell
  and next-bar rebalance; A01 on 30 synthetic stocks × 2 years with NIFTY 50 → completed, 2 year rows, tax, benchmark),
  `test_regime.py` (filter lookup, visual `exit_all` and `no_new_entries`); the missing-index message in `test_engine`.
- Deviations: new `save.py`; the A01 engine test lives in `test_rotation.py` (test_engine is already long).
Commands: backend-check 1007 passed. Guides: none.

## Review
Built and reviewed by Claude. Acceptance checks pass. Merged.
