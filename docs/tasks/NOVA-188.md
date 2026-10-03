# NOVA-188 — Intraday setups: opening range retest, previous day high retest, inside bar (D84)

**Status:** in-progress · **Owner:** Claude · **Branch:** task/NOVA-188 · **Depends on:** NOVA-187

## Goal
The three breakout ("trend" family) setups of `docs/INTRADAY-RESEARCH.md` §3 produce candidates with their own stop
and target, so an intraday run of these strategies trades end to end on recorded ticks.

## Read first
- `AGENTS.md` §8; `docs/INTRADAY-RESEARCH.md` §3 (table rows 1–3 + common rules); guide chapters 9, 11, 13 if unclear
- `backend/services/backtest/src/nova_backtest/intraday/setups/__init__.py`, `context.py`, `gate.py`

## Files
Create:
- `backend/services/backtest/src/nova_backtest/intraday/setups/breakout.py`
- `backend/services/backtest/tests/test_intraday_breakout.py`
Modify:
- `backend/services/backtest/src/nova_backtest/intraday/setups/__init__.py` (register the three kinds)

## Build
1. One state machine per stock and day, fed completed 1m bars (+ context). Buffer = `bufferAtr` × ATR at the bar.
2. `opening_range_retest`: OR from the stock's first `rangeMinutes` (complete, non-zero width, else no setup).
   **Breakout**: a 1m close > OR high + buffer. **Retest**: within the next `retestBars` bars (not the breakout bar)
   a bar with low ≤ OR high **and** close > OR high + buffer → candidate at that close, stop = that bar's low.
   Expired or a close below the stop first → the sequence ends; a new breakout may start a new one.
3. `prev_day_high_retest`: the same with the previous session high (from `context.py`; missing → no setup).
4. `inside_bar_continuation`: bar *i* strictly inside bar *i−1* (high < mother high, low > mother low); within the
   next `expiryBars` bars a close > mother high + buffer → candidate, stop = mother low. A close below the mother low
   ends it; nested inside bars do not reset the expiry.
5. All three are family `trend` (trend gate, upward context). Target = `targetR` × R from the **first fill**: the
   candidate carries `targetR`, the simulator fixes the price at the fill (NOVA-185 position). One candidate per
   sequence; candidates before `earliestEntry` are dropped by the guard, not here.

## Acceptance checks
- [ ] Guide examples as tests: ch. 9 (OR high ₹102, ATR ₹1, retest low ₹101.50 → stop 101.50); ch. 13 (PDH ₹102,
      buffer ₹0.10, retest low ₹101.60); ch. 11 (mother ₹100–104, inside ₹101–103, ATR ₹2 → trigger > ₹104.20, stop ₹100).
- [ ] Negative cases: breakout bar counted as its own retest → no; retest after the window → no; equal-boundary
      inside bar → no; zero-width OR → no.
- [ ] An end-to-end recorded run (synthetic ticks) of each setup with `single` buying produces the expected trade.
- [ ] `docker compose run --rm backend-check` passes.

## Out of scope
- Pullback/reclaim setups (189), adds (190), VWAP range reversion (later).
- Deploy: `backtest backtest-worker` with `--no-deps` (no migration).

## Questions
_(implementer writes here if blocked)_

## Handoff
**Done:** `setups/breakout.py` (`LevelRetest` for the opening range and previous day high, `InsideBar`), registered
in `setups/__init__.py`; guide ch. 9, 11, 13 examples and the negative cases as tests; each setup trades end to end.
**Files changed:** the listed files, plus `tests/intraday_factory.py` (bar tapes, warm-up sessions, `live_replay`),
`tests/test_intraday_replay.py` (the "no setup yet" test now uses `vwap_trend_pullback`), `docs/guides/API.md`.
**Commands run:** `docker compose run --rm backend-check` pass (1,602 tests).
**New dependencies:** none. **Maps updated:** none. **Guides updated:** API (which setups run).
**Deviations from task:** the OR needs a bar in the first minute (09:15) besides a non-zero width; a close below the
level (OR high / PDH) ends a retest sequence; with no ATR yet the buffer is 0 and the guard answers `warmup`.
End-to-end: all three through the real setup, context, checks and guard (replay level); the opening range retest
also through the worker and the database.
**Known gaps:** none.

## Review
_(reviewer — Claude or ChatGPT, ≤ 20 lines — see `docs/templates/REVIEW.md`)_
