# NOVA-065 — Backtest engine: catalog params, "bars ago" offset, trend + momentum indicators (D51)

**Status:** done · **Owner:** Claude · **Branch:** task/NOVA-065 · **Depends on:** NOVA-064

## Goal
Visual strategies can use every trend and momentum indicator in the catalog, with their real params (MACD
`fast`/`slow` are no longer silently replaced), and any price or indicator "N bars ago".

## Read first
- `AGENTS.md`, `docs/DECISIONS.md` (D45, D51), `docs/tasks/NOVA-064.md` (catalog table)
- `backend/services/backtest/src/nova_backtest/{indicators.py,rules.py,bars.py}`
- `backend/services/backtest/tests/{test_indicators.py,test_rules.py}`

## Files
Create: `nova_backtest/indicators_trend.py`, `nova_backtest/indicators_momentum.py`,
`services/backtest/tests/test_indicators_trend.py`, `services/backtest/tests/test_indicators_momentum.py`
Modify: `nova_backtest/{indicators.py,rules.py}`, `tests/{test_indicators.py,test_rules.py}`

## Build
1. `indicator(name, params, bars)`: first `nova_contracts.indicators.check_params` (a `ValueError` fails the run
   with its message, e.g. "Unknown setting 'period' for MACD line: open the strategy and save it again"), then
   fill defaults from the catalog (drop the local `whole()` defaults). Dispatch by a dict, not an if-chain.
   Names from 066 (volume, channels, levels) raise `ValueError("… is not available yet")` until 066.
2. Keep every function returning one value per bar, `None` until there is enough data, rupee floats.
3. `indicators_trend.py`: `wma` (weights 1…n) · `macd_signal` (EMA(`signal`) of the MACD line, seeded when the
   line has `signal` values) · `macd_hist` (line − signal) · `bb_middle` (= SMA) · `supertrend` (ATR as today,
   hl2 ± multiplier × ATR, standard final-band carry and flip on close; value is the active band; first value
   treated as up-trend) · `adx`, `plus_di`, `minus_di` (Wilder, period `n`; ADX first value at index 2n − 1) ·
   `psar` (Wilder; start up-trend at bar 1 with SAR = bar 0 low, EP = bar 0 high; acceleration += step up to max).
4. `indicators_momentum.py`: `stoch_k` = SMA(`smooth`) of 100 × (close − LL)/(HH − LL) over `period`
   (flat range → 50) · `stoch_d` = SMA(`signal`) of `stoch_k` · `stoch_rsi` = 100 × (RSI − min)/(max − min) of
   RSI(`rsi_period`) over `period` (flat → 50) · `cci` = (TP − SMA(TP))/(0.015 × mean deviation), TP = (H+L+C)/3,
   zero deviation → 0 · `williams_r` = −100 × (HH − close)/(HH − LL) (flat → −50) · `roc` = 100 × (C/Cₙ − 1).
5. `rules.py` offset: `SeriesCache` computes and caches the series of the operand *without* `offset`, then
   returns it shifted (`out[i] = base[i − offset]`, `None` for `i < offset`). Crosses keep comparing i − 1 with i
   on the shifted series. Numbers ignore offset.
6. Each file ≤ 300 lines; mypy strict; no new dependency.

## Acceptance checks
- [ ] Each new indicator has a hand-checked small test (5–30 bars, values written in the test with the arithmetic
      in a comment) plus a `None`-prefix length test.
- [ ] `macd` with `{fast: 5, slow: 10}` differs from the defaults; `{period: 20}` fails the run with the message.
- [ ] Rules test: `close gt high offset 1` fires only when close beats the previous bar's high; offset 3 is `None`
      for the first 3 bars; crosses with offset tested.
- [ ] Existing engine, rules and worker tests pass unchanged. `backend-check` passes. AGENTS §9.

## Out of scope
- Volume, volatility channels, levels (066). Python ctx (068). Editor (067). Performance tuning (no numpy).

## Questions

## Handoff
Built by Claude (Antigravity offline). All acceptance checks pass.
- `indicator()` checks settings with `check_params`, fills catalog defaults, dispatches by dict; 066 names raise
  "… is not available yet". MACD now honours `fast`/`slow` and refuses `period`.
- New `indicators_core.py` (not in Files): shared building blocks moved out of `indicators.py` so the trend and
  momentum modules can import them without a cycle. `indicators.py` re-exports the old names.
- Bad stored settings fail the run up front (`RuleSignals` → `EngineError` "…: open the strategy and save it again");
  the worker turns any other ValueError into "Unexpected error", so the check must happen there.
- `SeriesCache` caches the series without offset and shifts it; crosses use the shifted series.
- Checks: Docker pytest backtest + contracts 186 passed; ruff, mypy strict clean. Guides: none (067).

## Review
Self-reviewed. Hand-checked values: WMA, MACD signal/hist, SuperTrend flip, +DI/−DI/ADX (5 bars), PSAR reversal, Stochastic %K/%D, Stoch RSI, CCI, Williams %R, ROC; None-prefix lengths per default.
