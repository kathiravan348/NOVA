# NOVA-183 — Contracts: intraday strategy spec (setup + buying rule) + run profile/scenario fields (D84)

**Status:** planned · **Owner:** — · **Branch:** task/NOVA-183 · **Depends on:** NOVA-182

## Goal
A fourth strategy mode `intraday` (a setup + a buying rule, `docs/INTRADAY-RESEARCH.md` §3–§4) and the run fields
that name a research profile and a scenario exist in Zod + Pydantic, mocks and services. Screens show intraday
strategies read-only; nothing runs them yet (NOVA-185).

## Read first
- `AGENTS.md` §7, §8; `docs/DECISIONS.md` D34, D62, D84; `docs/INTRADAY-RESEARCH.md` §3, §4
- `backend/libs/nova_contracts/src/nova_contracts/strategy.py` (`StrategySpec`, `spec_param_problems`), `backtest.py`

## Files
Create:
- `backend/libs/nova_contracts/src/nova_contracts/intraday.py`, `backend/libs/nova_contracts/tests/test_intraday.py`
- `frontend/packages/contracts/src/intraday.ts`, `intraday.test.ts`
Modify:
- `backend/libs/nova_contracts/src/nova_contracts/strategy.py`, `backtest.py`, `__init__.py`; `tests/test_backtest.py`
- `frontend/packages/contracts/src/strategy.ts`, `strategyWrite.ts`, `backtest.ts`, `index.ts`, `jsonSchema.test.ts`, `schema/*.json` (`schema:update`)
- `frontend/packages/mocks/data/strategies.json` (+1 intraday strategy), `data/backtestRuns.json` (+1 intraday run), `src/schemas.test.ts`
- `frontend/apps/nova-orbit/src/lib/specLines.ts`, `specLines.test.ts`, `pages/strategies/StrategySpecCard.tsx`,
  `pages/strategies/strategyFilters.ts`, `strategyFilters.test.ts`, `pages/editor/StrategyEditorPage.tsx`, `pages/editor/ModeSwitch.tsx`
- `docs/CONTRACTS.md`

## Build
1. `StrategySpecIntraday`: `mode: "intraday"`, `segment: "equity_intraday"`, `exchange: "NSE"`, `timeframe: "1m"`,
   `setup`, `buying`. `setup` is discriminated by `kind` (`opening_range_retest`, `prev_day_high_retest`,
   `inside_bar_continuation`, `vwap_trend_pullback`, `failed_breakout_reclaim`) with exactly the §3 params and
   defaults; ranges: bars 1–20, ATR multiples > 0 and ≤ 5, `targetR`/`minRewardR` 0.5–10, minutes 5–120,
   `exit` `vwap` | `range_mid`. `buying` by `kind`: `single` (no params); `average_on_recovery`
   {`initialPercent` 10–100, `triggerAtr` > 0 ≤ 5, `confirmBars` 1–5, `expiryMinutes` 1–60};
   `add_to_winner` {`initialPercent`, `triggerR` > 0 ≤ 5, `confirmBars`, `expiryMinutes`}. Defaults per §4.
2. Add it to `StrategySpec`/`AnySpec` (both languages); `spec_param_problems` returns none for it.
3. Runs: `BacktestRunCreate` and `BacktestVersionCreate` get optional `profileId`, `profileVersion` (≥ 1) and
   `scenario` (`base` | `stress`), all three or none. `BacktestRun` gets the same three plus `experimentId`, all
   nullable (null on every existing run). Exit reasons add `daily_shutdown` and `unresolved`.
4. Screens (read-only): `specLines` describes an intraday spec in plain words (e.g. "Setup: opening range retest,
   15 min range, retest within 3 bars, 0.1 ATR buffer, target 2R · Buying: single entry"); the spec card shows
   them; the strategies filter gets mode **Intraday**; the editor opened on an intraday strategy shows a notice
   "Intraday setups are edited in their own form (coming soon)" and no form; `ModeSwitch` does not offer it yet.

## Acceptance checks
- [ ] Schema tests: every setup and buying kind with defaults valid; out-of-range values and extra keys rejected.
- [ ] Parity tests: Pydantic dumps of the new spec, run bodies and run validate against the generated schemas.
- [ ] Mocks: one intraday strategy + run pass the schema test; the strategy page renders its lines (test).
- [ ] `pnpm review:check` and `docker compose run --rm backend-check` pass.

## Out of scope
- Database, run validation and the simulator (NOVA-185); the intraday editor form (NOVA-195); Library entries (NOVA-200).

## Questions
_(implementer writes here if blocked)_

## Handoff
_(implementer, ≤ 20 lines — see `docs/templates/HANDOFF.md`)_

## Review
_(reviewer — Claude or ChatGPT, ≤ 20 lines — see `docs/templates/REVIEW.md`)_
