# NOVA-183 — Contracts: intraday strategy spec (setup + buying rule) + run profile/scenario fields (D84)

**Status:** done · **Owner:** Claude · **Branch:** task/NOVA-183 · **Depends on:** NOVA-182

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
**Done:** intraday spec (5 setups × 3 buying rules) in Zod + Pydantic, run profile/scenario/experiment fields, two exit reasons, read-only Orbit screens.
**Files changed:** the listed files, plus `contracts/src/trade.ts`, `backend/.../trade.py`, `mocks/data/strategyStats.json` (stats row for `stg_006`),
`mocks/src/handlers/orbit.ts` (+ test), `orbit/src/lib/intradayText.ts` (new), `lib/format.ts`, `lib/strategyText.ts`,
`pages/strategies/StrategyFilters.tsx`, `pages/editor/editorForm.ts`, `editorFormExtras.ts` (+ 2 tests),
`ui-trading/.../TradeTimeline.fixtures.ts`, `backend/services/backtest/.../strategy_engine.py`, `services/strategy/tests/test_library_expansion.py`.
**Commands run:** `pnpm review:check` pass; `docker compose run --rm backend-check` pass.
**Checked:** no new component; spec card reuses `DescriptionList` (360px/desktop, both themes as before).
**New dependencies:** none. **Maps updated:** CONTRACTS. **Guides updated:** none (no screen flow, endpoint or table change for users).
**Deviations from task:** `risingBars` is 2–20 (strictly rising needs two values); run create/version bodies take the three
profile fields as optional *nullable* (Pydantic dumps `null`); `BacktestRun` new fields default to null (mocks list them);
`CandleStrategySpec` type added so the editor form keeps its three modes; the candle engine refuses an intraday spec with
a plain error until NOVA-185; `ModeSwitch` needed no change (it never offered intraday).
**Known gaps:** the version-create mock handler inherits the previous run's profile when the body has none (NOVA-185 sets the backend rule).

## Review
**Result:** done
**Reviewer / built by:** Claude / Claude. **Self-review:** yes (Owner asked for self-review, 4 Oct 2026; same session).
**Fixed directly (review: commits):** `USER-GUIDE.md` (Intraday in the Mode filter, Setup/Buying lines, edit notice);
editor test for the intraday notice (no form, link back).
**Change requests:** none.
**Guides checked:** USER-GUIDE fixed directly; API/DATABASE not affected (no endpoint or table change).
**Rulebook issues found:** none. Deviations in the handoff accepted (`risingBars` ≥ 2, nullable create fields).
**Follow-up tasks created:** none (backend version-create profile rule belongs to NOVA-185).
