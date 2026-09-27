# NOVA-114 — Contracts: spec v2, rotation mode, result metrics + year table (D62)

**Status:** planned · **Owner:** — · **Branch:** task/NOVA-114 · **Depends on:** —

## Goal
The wire contracts can describe D62 (3), (4) and (6) on both sides, with parity tests, and Orbit shows the new spec parts as
read-only text. Engine support comes in NOVA-115–117, the editor inputs in NOVA-118/119, and the 5 new indicators in NOVA-116.

## Read first
- `AGENTS.md`; `docs/DECISIONS.md` D51, D53, D60, D62; `docs/CONTRACTS.md`; every file under Files

## Files
Create: `frontend/packages/contracts/src/strategyPortfolio.ts` (+ `.test.ts`), `backend/libs/nova_contracts/src/nova_contracts/strategy_portfolio.py`
Modify:
- `frontend/packages/contracts/src/{strategy,backtest,index}.ts`, `{strategy,backtest}.test.ts`; `schema/*.json` (`pnpm --filter @nova/contracts schema:update`)
- `backend/libs/nova_contracts/src/nova_contracts/{strategy,backtest,__init__}.py`, `backend/libs/nova_contracts/tests/{test_strategy,test_backtest}.py`
- `frontend/packages/mocks/data/{strategies,strategyStats,backtestRuns,backtestResults}.json`, `frontend/packages/mocks/src/orbit.consistency.test.ts`
- `frontend/apps/nova-orbit/src/lib/{strategyText,specLines}.ts` (+ tests); `…/pages/strategies/{StrategySpecCard,StrategiesPage}.tsx`
  (not `StrategyDetailPage.tsx`: NOVA-112 edits it); `…/pages/editor/{editorForm.ts,StrategyEditorPage.tsx}`; `docs/CONTRACTS.md`

## Build
1. Price and indicator operands get an optional `multiplier` (> 0, multiplies the value). `Risk` gets these optional fields
   (absent = off): `trailingStopPercent` (> 0, ≤ 50), `atrStop {period: int ≥ 1, multiplier: > 0}` and `maxHoldBars` (int 1–5000).
2. `strategyPortfolio.ts`:
   - `Portfolio {maxPositions: int 1–100, rank?: {by: price|indicator operand, order: "desc"|"asc"}}`
   - `Regime {index: IndexName, condition: Condition, whenOff: "no_new_entries"|"exit_all"}`
   - `ScoreTerm {operand: price|indicator operand, weight: number ≠ 0}`
   - `Rotation {rebalance: "weekly"|"monthly"|"quarterly", hold: int 1–50, keepWithin: int 1–100 and ≥ hold, score: ScoreTerm[1..3], filter?: RuleGroup}`
3. Visual and Python specs get optional `portfolio` and `regime`. Add a third spec mode, `StrategySpecRotation`:
   `{mode: "rotation", segment: "equity_delivery", exchange, timeframe: "1d", risk, regime?, rotation}`.
   `specParamProblems` checks every indicator operand anywhere in the spec: rules, rank, regime, score and filter.
   The backend mirrors all of this. Optional fields use `exclude_if=lambda v: v is None` (like `averaging`), so old specs round-trip unchanged.
4. `BacktestMetrics` gets these fields. They are always present and `null` when unknown (old runs):
   - `benchmarkReturnPercent`, `benchmarkCagrPercent`
   - `exposurePercent` (0–100), `avgHoldDays` (≥ 0), `profitFactor` (≥ 0), `calmar`
   - `estimatedTaxPaise` (≥ 0), `afterTaxNetPnlPaise`, `afterTaxCagrPercent`

   `BacktestResult` gets `years: YearRow[]`, where `YearRow` is `{year: int ≥ 1, from, to, returnPercent, profitPaise,
   maxDrawdownPercent ≤ 0, benchmarkPercent | null}`. The Python fields default to `None` and `[]`, so today's engine and
   `convert.py` keep working unchanged.
5. Mocks:
   - Add "Turtle 55/20 (ranked)" (visual, with every new risk field, portfolio, regime and one multiplier) and
     "12-1 momentum rotation" (rotation), with stats rows for both.
   - Give the mock results `years` and the new metrics. Consistency rule: when `years` is non-empty, the sum of `profitPaise` equals `netPnlPaise`.
6. Orbit read-only text:
   - `modeLabel(spec)` returns "Visual", "Python" or "Rotation". The detail page's Versions column switches to it in NOVA-118.
   - Operand text shows a multiplier, e.g. "1.5 × Volume SMA(50)".
   - The spec card lists trailing stop, ATR stop, max hold, portfolio, market filter and the rotation settings.
   - The editor shows an EmptyState for a rotation spec: "Rotation strategies cannot be edited here yet."

## Acceptance checks
- [ ] Parity tests for every new type; schema JSON updated; every existing mock and stored spec shape still parses.
- [ ] Refused: `keepWithin < hold`, 0 or 4 score terms, weight 0, a number operand in `rank` or `score`, bad indicator settings anywhere.
- [ ] The detail page of both new mocks shows every new line (`strategyText`/`specLines` tests); checked at 360px and desktop, dark and light.
- [ ] `docker compose run --rm backend-check` and `pnpm review:check` pass. Guides: none (users cannot create these yet).

## Out of scope
- Engine behaviour (NOVA-115–117), editor inputs (NOVA-118/119), results screens (NOVA-120), new indicators and DB columns (NOVA-116).

## Questions
_(implementer writes here if blocked)_

## Handoff
_(implementer, ≤ 20 lines — see `docs/templates/HANDOFF.md`)_

## Review
_(Claude, ≤ 20 lines — see `docs/templates/REVIEW.md`)_
