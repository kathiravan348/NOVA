# NOVA-031 — Universe moves from strategy to backtest run

**Status:** done · **Owner:** Claude · **Branch:** main · **Depends on:** NOVA-030

## Goal
A strategy is rules only (D25); each `BacktestRun` stores its universe (symbols or an index), and Orbit
shows it on the run list, result page and compare.

## Files
Modify: contracts `strategy.ts`, `backtest.ts` (+ tests); mocks `strategies.json`, `backtestRuns.json`,
`marketData.consistency.test.ts`; Orbit `lib/strategyText.ts` (+ test), `pages/editor/{editorForm.ts,
editorForm.test.ts,BasicsFields.tsx,editor.test.tsx}`, `pages/strategies/StrategySpecCard.tsx`,
`pages/backtests/{backtestForm.ts,backtestForm.test.ts,NewBacktestPage.tsx,BacktestsPage.tsx,
BacktestResultPage.tsx,backtests.test.tsx}`, `pages/compare/{ComparePage.tsx,RunPicker.tsx}`; `docs/CONTRACTS.md`.

## Acceptance checks
- [x] `StrategySpec` has no `universe`; `BacktestRun.universe` is required (min 1 symbol).
- [x] Mock runs: run_001 3 symbols, run_002 NIFTY 50, run_003 2 symbols, run_004 12 symbols, run_005 SBIN;
      every trade symbol is in its run's universe (test).
- [x] Editor has no Universe card; the run form has a Symbols card (text for now, picker in NOVA-035).
- [x] Run list "Symbols" column, result "Symbols" row, compare cards and run picker show the universe.

## Out of scope
- Symbol picker (NOVA-035), per-symbol results (NOVA-037).

## Handoff
**Done:** Built by Claude directly on `main` (Gemini offline; Owner request 2026-09-23).
**Checked:** contracts, mocks, services, Orbit tests pass; typecheck and lint pass.

## Review
**Result:** done (self-built; no separate review).
