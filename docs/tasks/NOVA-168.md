# NOVA-168 — Recorded runs fill at bid/ask (D82)

**Status:** done · **Owner:** Claude · **Branch:** task/NOVA-168 · **Depends on:** NOVA-167

## Goal
In a `recorded` run every buy fills at the best ask and every sell at the best bid of the first tick at or after
the fill moment, and the result shows the spread cost. History runs give exactly the same results as before.

## Read first
- `AGENTS.md`; `docs/DECISIONS.md` rows D53, D61 (4), D77, D82 (5)
- `nova_backtest/{simulate,book,scratch,strategy_engine,save,metrics}.py`; `nova_db/tick_bars.py` (NOVA-167)

## Files
Create:
- `backend/services/backtest/src/nova_backtest/quotes.py`, test `backend/services/backtest/tests/test_quotes.py`
Modify:
- `backend/libs/nova_db/src/nova_db/tick_bars.py` (+ `read_quotes`), its test
- `backend/services/backtest/src/nova_backtest/{simulate,scratch,strategy_engine,save,metrics}.py`,
  tests `test_simulate.py`, `test_scratch.py`, `test_engine.py`
- `docs/guides/USER-GUIDE.md` (how recorded runs fill; **Spread cost**), `docs/guides/API.md` (`spreadCostPaise`)

## Build
1. `tick_bars.read_quotes(db, archive_root, exchange, symbol, day)`: int64 arrays `ts` (exchange time, UTC epoch
   seconds), `ltp`, `bid` (`bid_price_paise[1]`), `ask` (`ask_price_paise[1]`); a missing or 0 quote is 0. Same
   source rules and session window as `read_tick_bars`.
2. `quotes.Quotes` (per stock, stored next to the columns in the run scratch folder as memmaps):
   `buy_price(t)` / `sell_price(t)` = ask / bid of the first tick with `ts ≥ t` on the same IST day (`searchsorted`);
   no tick → `None` (the simulator keeps today's price); quote 0 → that tick's `ltp`.
   `cross_buy(t0, t1, level)` / `cross_sell(t0, t1, level)`: first tick inside the bar whose `ltp ≤ level` (stop, add)
   or `≥ level` (target), priced like above.
3. `simulate`: an optional `fills` hook (None = today's behaviour). Pending buys and sells, square-off and signal
   fills use `buy_price` / `sell_price` at the bar time; stops, targets and averaging adds trigger on the bar as
   today and fill at `cross_*`. Sizing still uses the previous close.
4. Spread cost = Σ |fill price − that tick's `ltp`| × qty over every fill; saved to `spread_cost_paise`
   (null for history runs).

## Acceptance checks
- [ ] Unit: ask/bid taken from the first tick at or after the time; a zero quote falls back to `ltp`; a tick
      on the next day is never used.
- [ ] A recorded run's buy fills at the ask and its sell at the bid; `spreadCostPaise` equals the hand-worked value.
- [ ] Every history engine test and `reference_simulate` comparison passes unchanged.
- [ ] `docker compose run --rm backend-check`. Deploy: `docker compose up -d --build --no-deps backtest backtest-worker`.

## Out of scope
- Depth beyond level 1, partial fills, queue position, latency model, the trade ledger (174), screens (169).

## Questions

## Handoff
- Built by Claude, 3 Oct 2026. `quotes.py`: `TickQuotes`, `QuoteBook` (memmaps in the run scratch folder,
  `at` = first tick at/after t on the same IST day, `cross` = first tick in the bar past a level).
  `read_quotes` lives in `nova_backtest/tick_bars.py` (NOVA-167 moved the reader there, not `nova_db`).
- `simulate`: optional `fills`; open fills (buys, signal sells, square-off) use `at`; stops, targets and adds
  use `cross`; `Simulation.spread_cost` (None without fills) → `backtest_results.spread_cost_paise`.
  Sizing uses the fill price, as history runs size on the bar open (the task text said previous close).
- Engine: recorded runs fill a `QuoteBook` while loading each stock and refuse non-intraday specs.
- Tests: `test_quotes.py`; `test_tick_bars.py` end to end (ask 107.10 / bid 107.95, spread 150 paise). All
  history simulator and engine tests unchanged. backend-check 1,373 passed.
- Guides: API (fills, `spreadCostPaise`), USER-GUIDE (known limits: how recorded runs fill).

## Review
Self-review: yes (Owner allowed self-review on 3 Oct 2026). Matches the task. Deployed Saturday 3 Oct 2026:
`up -d --build --no-deps backtest backtest-worker`. Verdict: done.
