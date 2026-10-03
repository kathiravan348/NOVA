# NOVA-187 — Intraday simulator: market gate, context, warm-up from history (D84)

**Status:** done · **Owner:** Claude · **Branch:** task/NOVA-187 · **Depends on:** NOVA-179, NOVA-186

## Goal
The intraday simulator knows, at each 1m close, the inputs of `docs/INTRADAY-RESEARCH.md` §6: ATR, stock VWAP,
relative volume, stock context and range condition, previous session levels and the NIFTY 50 trend/range gate,
and the guard applies the checks `market_gate`, `context`, `relative_volume`, `warmup`, `stop_too_narrow`,
`stop_too_wide`, `reward_room`. Inputs that come from Kite history are listed on the run.

## Read first
- `AGENTS.md` §8; `docs/DECISIONS.md` D82, D84; `docs/INTRADAY-RESEARCH.md` §2 (Market, Signal), §3 (common rules), §6
- `backend/services/backtest/src/nova_backtest/intraday/guard.py`, `tick_data.py`; `indicators_core.py` (ATR, EMA)

## Files
Create:
- `backend/services/backtest/src/nova_backtest/intraday/context.py` (per-stock inputs), `gate.py` (index gate), `warmup.py`
- `backend/services/backtest/tests/test_intraday_context.py`, `test_intraday_gate.py`
Modify:
- `backend/services/backtest/src/nova_backtest/intraday/guard.py`, `engine.py`, `tick_data.py`; `tests/test_intraday_guard.py`

## Build
1. `context.py` (all values known only after the bar closes): Wilder ATR(`atrPeriod`) on 5m true ranges; VWAP =
   the tick's `avg_price_paise` at the bar close; EMA(`contextEmaPeriod`) on 5m closes; **upward context** = last
   5m close > VWAP and > EMA, EMA > its value 3 bars earlier; **range condition** = high − low of the last 6 5m bars
   ≤ `rangeSpanAtr` × ATR; **relative volume** = today's cumulative volume at the elapsed minute ÷ mean volume at
   the same minute over `volumeBaselineSessions` earlier sessions; previous session high/low.
2. `warmup.py`: ATR warm-up, the volume baseline and previous session levels use earlier **recorded** days first,
   then Kite `history` 1m/1d candles (`candles` table) for the missing days. Each input taken from history is added
   once to `backtest_runs.history_inputs` (e.g. `atr:history`, `volume_baseline:history`, `prev_day:history`).
   Not enough data → that check fails with `warmup` (never a guessed value).
3. `gate.py`: index bars from `index_ticks` (NOVA-179) for `marketIndex`; a day without index ticks uses Kite 1m
   index candles and is listed in `history_inputs` (`index:<date>`). Index OR = first `indexRangeMinutes`.
   **Trend gate**: last completed 1m index close > index OR high. **Range gate**: index close inside its OR and
   not down more than `declineVetoPercent` over the last 3 completed 5m bars. No index data → `market_gate`.
   `marketGate: false` skips the gate.
4. `guard.py`: add the checks in the §5.4 order. Stop distance in ATR units vs `minStopAtr`/`maxStopAtr`;
   `reward_room` = (target − entry) ÷ (entry − stop) < the setup's target/min reward R. Relative volume becomes
   the second ranking key (NOVA-186 used 0).

## Acceptance checks
- [ ] Context tests on synthetic bars: ATR matches a hand calculation; VWAP from `avg_price_paise`; context
      true/false cases; range condition; relative volume 1.2× case from guide ch. 6.
- [ ] Gate tests: trend gate pass/fail at the OR high; range gate with a 0.4 % fall → veto; no index → `market_gate`.
- [ ] Warm-up: missing recorded days filled from candles and listed in `history_inputs`; nothing at all → `warmup`.
- [ ] `docker compose run --rm backend-check` passes.

## Out of scope
- Setup patterns (188, 189), adds (190). Sector gate (later). Changing D82 runs (candle simulator).
- Deploy: `backtest backtest-worker` with `--no-deps` (no migration).

## Questions
_(implementer writes here if blocked)_

## Handoff
**Done:** `context.py` (ATR, EMA, VWAP, upward context, range condition, relative volume, previous session levels per
1m bar), `gate.py` (index bars from `index_ticks`, Kite 1m fallback listed `index:<date>`, trend/range gate, decline
veto), `warmup.py` (earlier recorded days, else Kite 1m candles; `atr|volume_baseline|prev_day:history` listed);
`guard.py` `SignalChecks` (§5.4 order) + the stop distance re-checked at the fill; relative volume ranks candidates.
**Files changed:** the listed files (index loading lives in `gate.py`, so `tick_data.py` did not change), plus
`intraday/replay.py` (`Signals.fits_at_fill`), `setups/__init__.py` (`StockDay.context`), `tests/conftest.py`
(truncates `candle_days`, `index_ticks`), `tests/intraday_factory.py` (history candles, rising volume, settings helper),
`docs/guides/API.md` (one paragraph on the checks).
**Commands run:** `docker compose run --rm backend-check`: 1,593 pass, 1 unrelated flaky failure
(`core/tests/test_realtime.py::test_deleting_a_job_is_announced`, passes alone twice).
**New dependencies:** none. **Maps updated:** none. **Guides updated:** API.
**Deviations from task:** relative volume leaves out the first minute everywhere (recorded bars hold the pre-open
auction there, Kite candles do not); 5m warm-up uses the last 3 earlier sessions; a missing input never fails
`context`, only `warmup`.
**Known gaps:** none.

## Review
**Result:** done
**Reviewer / built by:** Claude / Claude. **Self-review:** yes (Owner asked for self-review, 4 Oct 2026; same session).
**Fixed directly (review: commits):** none.
**Checked:** values use only closed bars (5m index from `searchsorted(end, at, "right")`); NaN inputs → `warmup`,
never a guessed level; E2E run lists the history inputs; flaky core realtime test is outside this task.
**Change requests:** none.
**Guides checked:** API simulator paragraph matches the diff; no table or endpoint change.
**Rulebook issues found:** none. Deploy `backtest backtest-worker` with `--no-deps` at a quiet time (D76).
**Follow-up tasks created:** none (flaky test noted to the Owner).
