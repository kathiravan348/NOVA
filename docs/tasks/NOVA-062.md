# NOVA-062 — Backtest engine v1: equity delivery, visual rules, results, trades, per-symbol breakdown

**Status:** done · **Owner:** Claude · **Branch:** task/NOVA-062 · **Depends on:** NOVA-055

## Goal
The backtest worker completes equity-delivery runs of visual strategies: signals from the spec's rules on stored
candles, next-open fills, stop-loss/target, Ledger charges per trade, and the result (metrics, daily equity curve,
per-symbol rows) written in one commit (D45). Intraday is 056; Python mode is 057.

## Read first
- `AGENTS.md` (§7, §8), `docs/DECISIONS.md` (D9, D10, D17, D25, D42, D44, D45)
- `frontend/packages/contracts/src/{strategy,backtest,trade}.ts`, `backend/services/backtest/src/nova_backtest/{engine,worker}.py`

## Files
Create: `nova_backtest/{bars.py,indicators.py,rules.py,simulate.py,metrics.py,delivery.py}`,
`services/backtest/tests/{test_indicators.py,test_rules.py,test_simulate.py,test_metrics.py,test_delivery.py}`
Modify: `nova_backtest/cli.py` (default engine), `docs/{DECISIONS,STRUCTURE}.md`

## Build
1. Indicators on rupee floats (signals only; money stays paise): SMA/EMA (`period`, default 20), RSI (14, Wilder),
   MACD line (`fast` 12, `slow` 26), VWAP (resets each IST day), ATR (14, Wilder), BB upper/lower (20, `stddev` 2).
   `None` until enough bars.
2. Rules: gt/gte/lt/lte/eq; crosses_above/below compare the previous bar; any `None` → false; all/any groups.
3. Simulation: bars merged by time across symbols; decide at close, fill at the next bar's open; stop checked before
   target inside a bar (gap → open); sizing fixed qty / fixed amount / % of equity (whole shares; skip if cash short);
   long only, one position per symbol, shared cash; open positions close at their last bar. Trading only inside
   the run period; bars before it warm up indicators (1d: 400 days, intraday: 30 days).
4. Charges via `nova_ledger` (rates on the entry date). Metrics: return %, CAGR (clamped to −100…1,000,000), max
   drawdown and Sharpe (√252) from the daily equity curve, wins (net > 0) / losses (net < 0), per-symbol rows for
   every universe symbol. Benchmark points are `null` (no index candles yet).
5. `DeliveryEngine.run`: resolve the universe (index → instruments with that index), load candles, replace any old
   trades/result, write everything and mark `completed` in one commit. Errors → `EngineError` with a plain message
   (Python mode → "arrives in NOVA-057", intraday → "arrives in NOVA-056", missing candles → which symbols).

## Acceptance checks
- [x] Hand-checked scenarios: next-open fills, stop and gap-down stop, target, sizing, cash limit, end-of-data close,
      indicator values, metrics; full run through the worker whose result and trades pass schema parity.
- [x] `backend-check` passes. Definition of done in `AGENTS.md` §9.

## Out of scope
- Short selling, intraday square-off (056), Python strategies (057), benchmark series, slippage models.

## Handoff
**Done:** Built by Claude on Owner request (2026-09-25). Engine v1 wired into the worker (`DeliveryEngine`).
**Commands run:** `backend-check` pass (309 tests). 22 hand-checked unit tests (fills, stop/target incl. gaps,
sizing, cash limit, end-of-data, indicators, metrics) + a full worker run with seeded Zerodha rates.
**New dependencies:** none.
**Deviations:** `bars.py` added (shared `Bar`). Equity curve is end-of-day, charges deducted at exit.
**Known gaps:** benchmark points are `null` (no index candles); long only; no slippage model.

## Review
**Result:** done
**Fixed directly:** `float ** float` typed as Any (→ `math.pow`); CAGR clamped so very short periods cannot overflow
`numeric(12,4)`. Docker Desktop had stopped mid-task; restarted it to run the database tests.
**Rulebook issues found:** none. **Follow-up tasks created:** none.
