# NOVA-143 — Strategy card: CAGR range, one value for one run

**Status:** in-progress · **Owner:** ChatGPT · **Branch:** task/NOVA-143 · **Depends on:** —

## Goal
Strategy cards compare runs by CAGR (runs of different lengths are comparable), and a strategy with one
completed run shows one value instead of equal **Best**/**Worst** boxes (D72 (3)).

## Read first
- `AGENTS.md`; `docs/DECISIONS.md` row D72; the files below.

## Files
Modify:
- `backend/libs/nova_contracts/src/nova_contracts/strategy_stats.py`, `backend/libs/nova_contracts/tests/test_strategy.py`
- `backend/services/strategy/src/nova_strategy/stats.py`, `backend/services/strategy/tests/test_stats.py`
- `frontend/packages/contracts/src/{strategyStats.ts,strategyStats.test.ts}`, `frontend/packages/contracts/schema/StrategyStats.json` (generated)
- `frontend/packages/mocks/data/strategyStats.json`, `frontend/packages/mocks/src/orbit.consistency.test.ts`
- `frontend/packages/ui-trading/src/components/StrategyCard/{StrategyStatsList.tsx,StrategyCard.test.tsx,StrategyCard.stories.tsx}`
- `frontend/apps/nova-orbit/src/pages/strategies/{StrategiesPage.tsx,strategies.test.tsx}`
- `docs/guides/{API.md,USER-GUIDE.md}`, `docs/tasks/{BOARD.md,NOVA-143.md}`

## Build
1. Contract `StrategyStats` (Python + Zod): add `bestCagrPercent` and `worstCagrPercent` (number | null).
   Same rules as the return pair: set exactly when a run completed, worst ≤ best. Keep every existing field
   (`bestReturnPercent`, `worstReturnPercent`, `byVersion` stay as they are). Re-run `schema:update`.
2. `stats.py` `_STATS`: `max(res.cagr_percent)`, `min(res.cagr_percent)` from the same completed-run join.
3. Mocks: add both fields, equal to max/min `cagrPercent` of that strategy's completed mock results; the
   consistency test checks them like the return pair.
4. `StrategyStatsList`, results block:
   - `runsCompleted === 1`: **Return** (`bestReturnPercent`) and **CAGR** (`bestCagrPercent`), one value each.
   - `runsCompleted ≥ 2`: **Best CAGR** and **Worst CAGR**, replacing **Best return** / **Worst return**.
   - Win rate, worst drawdown, best net P&L and last run unchanged. Signed tones as today.
   Stories: one run, several runs, no completed runs. Tests for both labels sets.
5. `StrategiesPage`: sort option **Best return** → **Best CAGR** (key `best` sorts by `bestCagrPercent`).
6. Guides: API (`GET /strategies/stats` row: best/worst CAGR), USER-GUIDE Step 2 (card text and sort label;
   explain CAGR once: average growth per year, so short and long tests compare fairly).

## Acceptance checks
- [x] A strategy with 1 completed + 1 running run shows **Return** and **CAGR**, no Best/Worst pair.
- [x] With 2 completed runs of different lengths the card shows **Best CAGR** / **Worst CAGR** from the API.
- [x] `test_stats.py` checks the two new fields against seeded results; contract tests refuse worst > best.
- [x] Stories checked at 360px and desktop, dark and light.
- [ ] Definition of done in `AGENTS.md` §9 (backend-check and `pnpm review:check`).

## Out of scope
- `byVersion` and the strategy version page (still best return), after-tax figures on the card, benchmark
  (NOVA-142), compare page, backtest result page.

## Questions
Owner approval requested: add the new CAGR fields to the existing StrategyStats row in docs/CONTRACTS.md (omitted from Files).

## Handoff
**Done:** SQL/contract CAGR extrema, static mocks, one-run card values, multiple-run CAGR range and CAGR sorting.
**Files changed:** all files listed above.
**Commands run:** focused frontend (60 tests), focused backend (37 tests), schema:update, pnpm review:check and backend-check (1,220 tests) pass.
**Checked:** Default / OneCompletedRun / NoCompletedRuns: 360px ✓ · 1440px ✓ · dark ✓ · light ✓.
**New dependencies:** none.
**Maps updated:** pending contract-map permission.
**Guides updated:** USER-GUIDE, API.
**Deviations from task:** none.
**Known gaps:** contract-map update awaits Owner approval. Initial backend gate hit a realtime WebSocket teardown CancelledError; full rerun passed.

## Review
_(reviewer — Claude or ChatGPT, ≤ 20 lines — see `docs/templates/REVIEW.md`)_
