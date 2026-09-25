# NOVA-064 — Indicator catalog + "bars ago" offset in the strategy contracts (D51)

**Status:** done · **Owner:** Claude · **Branch:** task/NOVA-064 · **Depends on:** NOVA-059

## Goal
The contracts know 38 indicators, each with its params (key, label, default, integer or decimal). Price and
indicator operands accept an optional `offset` (bars ago). Saving a strategy with bad indicator params is refused.

## Read first
- `AGENTS.md`, `docs/DECISIONS.md` (D34, D45, D51); the `Modify` files below (contracts side only)

## Files
Create: `frontend/packages/contracts/src/indicators.ts`, `frontend/packages/contracts/src/indicators.test.ts`,
`frontend/packages/contracts/schema/indicators.json` (generated),
`backend/libs/nova_contracts/src/nova_contracts/indicators.py`, `backend/libs/nova_contracts/tests/test_indicators.py`
Modify: `contracts/src/{strategy.ts,strategy.test.ts,jsonSchema.test.ts,index.ts}`, `contracts/schema/*.json`
(regenerated), `nova_contracts/{strategy.py,__init__.py}`, `nova_contracts/tests/test_strategy.py`,
`docs/CONTRACTS.md`, `docs/guides/API.md`

## Build
1. `indicators.ts`: `IndicatorGroup` = trend · momentum · volatility · volume · levels. `INDICATORS` (readonly, in
   this order) of `{ name, label, group, params: { key, label, default, integer }[] }`. `IndicatorNameSchema`
   (moved here from `strategy.ts`, re-exported) is built from these names. Defaults (`i` = integer, else decimal):
   - trend: `sma`,`ema`,`wma` (period 20i) · `macd` "MACD line" (fast 12i, slow 26i) · `macd_signal`, `macd_hist`
     (fast 12i, slow 26i, signal 9i) · `supertrend` (period 10i, multiplier 3) · `adx`, `plus_di` "+DI",
     `minus_di` "−DI" (period 14i) · `psar` "Parabolic SAR" (step 0.02, max 0.2)
   - momentum: `rsi` (14i) · `stoch_k` "Stochastic %K" (period 14i, smooth 3i) · `stoch_d` "Stochastic %D"
     (period 14i, smooth 3i, signal 3i) · `stoch_rsi` (rsi_period 14i, period 14i) · `cci` (20i) ·
     `williams_r` "Williams %R" (14i) · `roc` "Rate of change %" (12i)
   - volatility: `atr` (14i) · `bb_upper`,`bb_middle`,`bb_lower` (period 20i, stddev 2) · `keltner_upper`,
     `keltner_lower` (period 20i, multiplier 2, atr_period 10i) · `donchian_upper` "Highest high",
     `donchian_lower` "Lowest low" (period 20i)
   - volume: `vwap` (none) · `obv` (none) · `mfi` (14i) · `volume_sma` "Volume SMA" (20i)
   - levels (previous IST day, no params): `prev_day_high`, `prev_day_low`, `prev_day_close`, `pivot`,
     `pivot_r1`, `pivot_s1`, `pivot_r2`, `pivot_s2`
2. `checkIndicatorParams(name, params)`: list of messages — unknown key, integer param not a whole number ≥ 1,
   decimal param not > 0, `fast ≥ slow`. Missing keys are fine (engine uses defaults).
3. `strategy.ts`: `offset: z.number().int().min(0).max(500).optional()` on `OperandPrice` and `OperandIndicator`.
   `StrategyCreate` and `StrategyVersionCreate` get a refine that runs `checkIndicatorParams` on every indicator
   operand of a visual spec. `Strategy` (read) stays tolerant.
4. `jsonSchema.test.ts`: also write `INDICATORS` to `schema/indicators.json` (same snapshot mechanism).
5. Python: `nova_contracts.indicators` = `INDICATORS` loaded as frozen dataclasses + `check_params(name, params)`
   (same rules, raises `ValueError`). Test: equals `schema/indicators.json` (via `nova_testing.parity` paths).
   `IndicatorName` Literal lists the 38 names. `offset: Annotated[int, Field(ge=0, le=500)] = 0` on both operands.
   `model_validator` on `StrategyCreate`/`StrategyVersionCreate` calls `check_params` → 422 through the existing
   handler. Parity tests still pass.
6. `API.md`: strategy bodies — catalog (`schema/indicators.json`), `offset`, new 422. `CONTRACTS.md`: one line.

## Acceptance checks
- [ ] TS + Python tests: every default passes its own check; `{macd, {period: 20}}` and `{rsi, {period: 2.5}}`
      are refused on create; the same spec still parses as a `Strategy` read.
- [ ] `offset` 0–500 accepted, −1 / 501 / 1.5 refused, absent accepted (both sides).
- [ ] Python catalog equals `schema/indicators.json`; `pnpm review:check`, `backend-check` pass. AGENTS §9.

## Out of scope
- Engine, editor, Python ctx (065–068). Migrating stored specs (the editor refills defaults on load, 067).
## Questions

## Handoff
Built by Claude (Antigravity offline). All acceptance checks pass.
- Catalog: `contracts/src/indicators.ts` (+ `schema/indicators.json`), Python `nova_contracts.indicators`.
- `offset` on price/indicator operands; Python uses `exclude_if` so 0 is never written (old specs unchanged).
- Write bodies refuse bad params (TS superRefine, Python `_CheckedSpec`) → strategy service 400 (test added).
- Outside the Files list, to keep the build green: `nova-orbit/src/lib/strategyText.ts` falls back to catalog
  labels for new names (067 replaces the map); `services/strategy/tests/test_strategies.py` one test.
- Checks: `pnpm review:check` green; Docker pytest strategy + backtest + contracts: 167 passed.
- Guides: API.md (catalog, offset, 400).

## Review
Self-reviewed (no second agent). Parity: Python catalog equals the TS export; IndicatorName Literal equals the catalog order.
