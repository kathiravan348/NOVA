# NOVA-189 — Intraday setups: VWAP trend pullback, failed breakout reclaim (D84)

**Status:** in-progress · **Owner:** Claude · **Branch:** task/NOVA-189 · **Depends on:** NOVA-187 (merge after NOVA-188)

## Goal
The pullback setup (family `trend`) and the reclaim setup (family `range`) of `docs/INTRADAY-RESEARCH.md` §3 produce
candidates, so all five first-round setups run end to end.

## Read first
- `AGENTS.md` §8; `docs/INTRADAY-RESEARCH.md` §3 (rows 4–5 + common rules), §6; guide chapters 10, 12 if unclear
- `backend/services/backtest/src/nova_backtest/intraday/setups/__init__.py`, `setups/breakout.py` (style), `context.py`

## Files
Create:
- `backend/services/backtest/src/nova_backtest/intraday/setups/pullback.py`
- `backend/services/backtest/tests/test_intraday_pullback.py`
Modify:
- `backend/services/backtest/src/nova_backtest/intraday/setups/__init__.py` (register the two kinds)

## Build
1. `vwap_trend_pullback` (family `trend`): needs the last `risingBars` 5m VWAP values strictly rising (3 values, not
   3 rises) and upward context. **Pullback bar**: a 1m bar whose low is within ± `proximityAtr` × ATR of VWAP.
   Within the next `expiryBars` bars a close > the pullback bar's high → candidate; stop = lowest low since the
   pullback bar. A later pullback bar restarts the sequence; a close below the lowest low ends it.
2. `failed_breakout_reclaim` (family `range`): needs the previous session low and the range condition. **Break**: a
   1m low < previous low. Within `reclaimBars` bars a close > previous low → candidate; stop = lowest low of the
   sequence. Target = VWAP (`exit: vwap`, the tick average at the candidate close) or the stock OR midpoint
   (`range_mid`), **frozen** in the candidate; the guard's `reward_room` needs ≥ `minRewardR` from the fill.
3. One candidate per sequence; uses only completed bars; missing VWAP or previous low → no setup (the guard
   reports `warmup` only for ATR/baseline inputs).

## Acceptance checks
- [ ] Guide examples as tests: ch. 10 (VWAP ~₹100, ATR ₹1, pullback low ₹99.75 within ₹0.30; fill ₹100.40 → R ₹0.65);
      ch. 12 (prev low ₹100, low ₹98.80, reclaim; fill ₹100.20, VWAP target ₹103 → exactly 2R passes, ₹100.30 fails).
- [ ] Negative cases: VWAP flat over the 3 values → no; recovery only intrabar → no; reclaim after the window → no.
- [ ] End-to-end recorded run of each setup with `single` buying produces the expected trade; range gate applies to reclaim.
- [ ] `docker compose run --rm backend-check` passes.

## Out of scope
- `vwap_range_reversion` (later); adds (190); a moving VWAP exit (later variant).
- Deploy: `backtest backtest-worker` with `--no-deps` (no migration).

## Questions
_(implementer writes here if blocked)_

## Handoff
_(implementer, ≤ 20 lines — see `docs/templates/HANDOFF.md`)_

## Review
_(reviewer — Claude or ChatGPT, ≤ 20 lines — see `docs/templates/REVIEW.md`)_
