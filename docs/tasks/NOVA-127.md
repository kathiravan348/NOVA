# NOVA-127 — Five new indicators: catalog, engine and Python ctx (D62 (5))

**Status:** done · **Owner:** Claude · **Branch:** task/NOVA-127 · **Depends on:** NOVA-111, NOVA-114

## Goal
The catalog grows from 38 to 43 indicators: `volatility`, `risk_adj_return`, `pct_of_high`, `or_high` and `or_low`. Each one
works in visual rules, in rank and score operands, and as `ctx.<name>(…)` in Python mode. The editor lists them by itself,
because its list comes from the catalog (D51).

## Read first
- `AGENTS.md`; `docs/DECISIONS.md` D51, D58, D62; every file under Files

## Files
Create:
- `backend/services/backtest/src/nova_backtest/indicators_stats.py`, `backend/services/backtest/tests/test_indicators_stats.py`
Modify:
- `frontend/packages/contracts/src/{indicators,strategy}.ts`, `{indicators,strategy}.test.ts`, `schema/indicators.json` (`schema:update`)
- `backend/libs/nova_contracts/src/nova_contracts/{indicators,strategy}.py`, `backend/libs/nova_contracts/tests/{test_indicators,test_strategy}.py`
- `backend/services/backtest/src/nova_backtest/{columns,indicators,indicators_levels}.py`
- `backend/services/backtest/tests/{test_indicators,test_indicators_levels,test_sandbox}.py`; `docs/guides/USER-GUIDE.md`

## Build
1. Catalog entries (label, group, settings):
   | name | label | group | settings |
   |---|---|---|---|
   | `volatility` | "Volatility % (yearly)" | volatility | `period` 20 |
   | `risk_adj_return` | "Risk-adjusted return" | momentum | `period` 126 |
   | `pct_of_high` | "% of N-bar high" | momentum | `period` 252 |
   | `or_high` | "Opening range high" | levels | `minutes` 15 (integer) |
   | `or_low` | "Opening range low" | levels | `minutes` 15 (integer) |

   The catalog-count tests go from 38 to 43.
2. Write check (both sides): `or_high` / `or_low` anywhere in a spec whose timeframe is `1d` → "Opening range needs an intraday
   timeframe". Add it to `specParamProblems` / `spec_param_problems`.
3. `columns.py`: `Columns` gets `timeframe: str`. `load` sets it; `from_bars` takes it and defaults to `"1d"`.
4. `indicators_stats.py`:
   - `volatility(p)`: sample std dev (n − 1) of the last `p` bar-to-bar returns × √(bars per year) × 100. Bars per year:
     252 for 1d; 252 × {1m 375, 3m 125, 5m 75, 15m 25, 30m 13, 1h 7} intraday. The first value comes at index `p`.
   - `risk_adj_return(p)` = `roc(p) ÷ volatility(p)`; no value when the volatility is 0 or missing.
   - `pct_of_high(p)` = close ÷ highest high of the last `p` bars (today included) × 100.
5. `indicators_levels.py`, `or_high` / `or_low(minutes)`: each IST day, the high (low) of the bars that start before
   09:15 + `minutes`. The value appears from the first bar that starts at or after that time, lasts to the end of the day,
   and is empty before it and on `1d`.
6. `indicators.py` dispatch. Python mode needs nothing more: the sandbox reads the catalog (D51).

## Acceptance checks
- [ ] Hand-checked values:
  - volatility of a constant-return series is 0
  - a known two-value series gives the expected √252-scaled number
  - `pct_of_high` = 100 on a new high
  - on 15m bars, `or_high(15)` equals the 09:15 bar's high from the 09:30 bar onward; `or_high(30)` covers two bars
- [ ] The write check refuses `or_high` on 1d, on both sides. The parity test covers the catalog.
- [ ] A Python strategy that calls `ctx.volatility(20)` and `ctx.or_high(15)` runs (`test_sandbox`).
- [ ] `docker compose run --rm backend-check` and `pnpm review:check` pass. Guides: USER-GUIDE Orbit Step 4 lists the new
      indicators in one plain line each; update "State as of".

## Out of scope
- Using them in rotation or the market filter (NOVA-117); editor layout changes (the catalog drives it); the library (NOVA-121).

## Questions
_(implementer writes here if blocked)_

## Handoff
Done. Catalog 38 → 43 on both sides (`volatility` in Volatility; `risk_adj_return`, `pct_of_high` in Momentum;
`or_high`, `or_low` with `minutes` in Levels) plus `INTRADAY_ONLY`; `specParamProblems` / `spec_param_problems` add
"Opening range needs an intraday timeframe" for those on `1d`. `Columns.timeframe` (default `"1d"`; `load`,
`from_arrays`, `from_bars` take it). `indicators_stats.py`: volatility = sample std dev of the last N returns ×
√(252 × bars a day) × 100, first value at index N, computed on numpy windows in 20 k-row blocks;
`risk_adj_return` = ROC ÷ volatility (none at 0); `pct_of_high` = close ÷ N-bar highest high × 100.
`indicators_levels.opening_range`: high/low of the day's bars that start before 09:15 + minutes, shown from the first
bar at or after that time, none on `1d`. Python mode needed nothing (the sandbox reads the catalog).
- Deviations: the write check lives in `strategyWrite.ts` (where `specParamProblems` is), not `strategy.ts`; the new
  hand-checked tests are all in `test_indicators_stats.py` (including the sandbox case) instead of spread over
  `test_indicators*.py` / `test_sandbox.py`.
Commands: backend-check 987 passed; `pnpm review:check` passed. Guides: USER-GUIDE (Step 4 list, count 43).

## Review
Built and reviewed by Claude. Acceptance checks pass. Merged.
