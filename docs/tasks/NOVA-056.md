# NOVA-056 — Backtest engine: equity intraday (MIS square-off)

**Status:** done · **Owner:** Claude · **Branch:** task/NOVA-056 · **Depends on:** NOVA-062

## Goal
Visual strategies with segment `equity_intraday` run: positions never stay overnight (square-off from 15:20 IST, like
Zerodha MIS), and trades are charged at intraday rates (D42, D45, D46).

## Read first
- `AGENTS.md` (§8), `docs/DECISIONS.md` (D42, D45, D46), `backend/services/backtest/src/nova_backtest/{simulate,delivery}.py`

## Files
Modify: `nova_backtest/simulate.py` (`square_off`), `nova_backtest/delivery.py` → `visual.py` (`VisualEngine`), `cli.py`,
`tests/{test_simulate.py,test_delivery.py→test_visual.py}`, `docs/{DECISIONS,STRUCTURE}.md`

## Build
1. `simulate(..., square_off: time | None)`: on a bar at or after `square_off` (IST) drop the symbol's pending order,
   close its position at the bar's open, and take no new signal; on a new IST day drop a pending order and close any
   leftover position at the symbol's previous bar close (data gap).
2. `VisualEngine`: delivery as before; intraday needs a timeframe other than `1d` ("Intraday strategies need an
   intraday timeframe"), uses `square_off = 15:20` and `equity_intraday` rates.

## Acceptance checks
- [x] Hand-checked: square-off at 15:20 open, entry signal just before cut-off is dropped, day gap closes at the
      previous close, full intraday worker run with intraday charges. `backend-check` passes.

## Out of scope
- Short selling, bracket/cover orders, auto square-off times other than 15:20, futures/options.

## Handoff
**Done:** Built by Claude on Owner request (2026-09-25). `square_off` in the simulator; `VisualEngine` runs both segments.
**Commands run:** `backend-check` pass; backtest suite 44 tests incl. an intraday worker run (square-off 15:20, charges).
**New dependencies:** none. **Deviations:** none.

## Review
**Result:** done
**Fixed directly:** a script edit truncated `test_visual.py` (Windows default encoding on "₹"); restored from git and
rewritten with UTF-8. **Rulebook issues found:** none. **Follow-up tasks created:** none.
