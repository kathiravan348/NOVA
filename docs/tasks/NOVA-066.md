# NOVA-066 — Backtest engine: volume, channel and previous-day level indicators (D51)

**Status:** done · **Owner:** Claude · **Branch:** task/NOVA-066 · **Depends on:** NOVA-065

## Goal
Every one of the 38 catalog indicators works in a visual backtest: the "not available yet" names from 065 are
implemented.

## Read first
- `AGENTS.md`, `docs/DECISIONS.md` (D45, D51), `docs/tasks/NOVA-064.md` (catalog table)
- `backend/services/backtest/src/nova_backtest/{indicators.py,bars.py}` (note `Bar.ist_date`, and `vwap`)
- `backend/services/backtest/tests/test_indicators.py`

## Files
Create: `nova_backtest/indicators_volume.py`, `nova_backtest/indicators_levels.py`,
`services/backtest/tests/test_indicators_volume.py`, `services/backtest/tests/test_indicators_levels.py`
Modify: `nova_backtest/indicators.py` (dispatch only). Guides: none (067 describes the indicators to users).

## Build
1. `indicators_volume.py`: `obv` (starts at 0 on bar 0; + volume on an up close, − on a down close, same on
   unchanged) · `mfi` (TP = (H+L+C)/3, money flow = TP × volume, positive/negative by TP change, sums over
   `period`; no negative flow → 100) · `volume_sma` (SMA of volume, as a float).
2. `indicators_levels.py`, channels: `donchian_upper`/`donchian_lower` = highest high / lowest low of the last
   `period` bars *including* the current one · `keltner_upper`/`keltner_lower` = EMA(`period`) of close ±
   `multiplier` × ATR(`atr_period`) (reuse `ema` and `atr`).
3. `indicators_levels.py`, previous IST day (group bars by `Bar.ist_date`; for daily bars each bar is its day):
   `prev_day_high/low/close` = that day's high / low / last close; `None` on the first day in the data.
   Classic pivots from those: P = (H+L+C)/3, R1 = 2P − L, S1 = 2P − H, R2 = P + (H − L), S2 = P − (H − L).
4. `indicators.py`: add these to the dispatch dict; remove the "not available yet" branch and its test.

## Acceptance checks
- [ ] Hand-checked tests per indicator (values in the test, arithmetic in a comment).
- [ ] Levels: 5-minute bars across three IST days (UTC times near midnight IST) — day 1 is `None`, day 2 uses
      day 1's H/L/C, day 3 uses day 2's; a daily-bar series gives the previous bar's values.
- [ ] A visual backtest using `close crosses_above pivot_r1` and `mfi lt 20` runs end-to-end in `test_engine`
      style (new test in `test_indicators_levels.py` is fine).
- [ ] Each file ≤ 300 lines. `backend-check` passes. AGENTS §9.

## Out of scope
- Weekly/monthly pivots, Camarilla/Fibonacci pivots, index-based levels. Python ctx (068). Editor (067).

## Questions

## Handoff
Built by Claude (Antigravity offline). All acceptance checks pass.
- `indicators_volume.py` (OBV, MFI, Volume SMA), `indicators_levels.py` (Donchian, Keltner, previous IST day
  H/L/C, classic pivots P/R1/S1/R2/S2). Dispatch covers all 38 catalog names; the "not available yet" branch is gone.
- Levels test: 5-minute bars around IST midnight across three days; daily bars use the previous bar.
- End-to-end: `close crosses_above pivot_r1` + `mfi lt 20` run completes through the worker with one trade.
- Checks: Docker pytest backtest + contracts 194 passed; ruff, mypy strict clean. Guides: none (067).

## Review
Self-reviewed. Hand-checked OBV, MFI (incl. no negative flow → 100), Volume SMA, Donchian, Keltner, pivots.
