# NOVA-135 — Index backtests skip members with no prices in the period (D68, migration 0021, live bug)

**Status:** in-progress · **Owner:** ChatGPT · **Branch:** task/NOVA-135 · **Depends on:** —

## Goal
A backtest on a whole index (e.g. NIFTY 100, 2021–2024) runs on the members that have prices and skips the
members listed later, instead of failing; the run answers which symbols it skipped (D68 (2)).

## Read first
- `AGENTS.md`; `docs/DECISIONS.md` D34, D61, D68; `docs/CONTRACTS.md` (backtest); every file under Files

## Files
Create:
- `backend/libs/nova_db/src/nova_db/migrations/versions/rev0021_backtest_skipped_symbols.py`
Modify:
- `backend/libs/nova_db/src/nova_db/models/backtest.py`, `backend/libs/nova_db/tests/test_migrations.py` (head 0021)
- `backend/libs/nova_contracts/src/nova_contracts/backtest.py`, `backend/libs/nova_contracts/tests/test_backtest.py`
- `frontend/packages/contracts/src/backtest.ts`, `backtest.test.ts`, `schema/BacktestRun.json` (`schema:update`)
- `frontend/packages/mocks/data/backtestRuns.json`, `src/handlers/orbit.ts`, `src/handlers/orbit.test.ts`
- `backend/services/backtest/src/nova_backtest/strategy_engine.py`, `convert.py`
- `backend/services/backtest/tests/test_engine.py`, `tests/test_api.py`
- `docs/CONTRACTS.md`, `docs/guides/API.md`, `docs/guides/DATABASE.md`

## Build
1. Migration 0021: `backtest_runs.skipped_symbols` `text[]` not null, server default `'{}'`. Model to match.
2. Contracts: `BacktestRun.skippedSymbols` = array of `SymbolSchema` (Python: `list[Symbol]`), always present
   (`[]` when none). Every mock run gets `"skippedSymbols": []`; one completed NIFTY 100 index mock run gets
   `["HYUNDAI", "TATACAP"]`. The mock POST handlers answer `[]`. Parity + schema tests.
3. `strategy_engine._load`: return the loaded symbols and the missing ones instead of raising. In `run`:
   - universe `symbols` and anything missing → raise the same error as today (text unchanged);
   - universe `index`: none loaded → `EngineError("No stock in <index> has <tf> prices in the period
     (download them first)")`; else set `run.skipped_symbols = missing` (sorted) before `save_result`,
     and pass only the loaded symbols to `save_result`.
4. `convert.run_contract`: `"skipped_symbols": list(row.skipped_symbols)`.
5. Guides: API `GET /backtests/{id}` row (new field, index-run rule); DATABASE `backtest_runs` row + migration
   range. CONTRACTS.md: the new field.

## Acceptance checks
- [x] Engine test: an index run where one member has no bars completes; `skipped_symbols` names it; its
      `bySymbol` has no row for it. All members missing → failed with the new message.
- [x] Engine test: a `symbols` run with a missing symbol still fails with the old message.
- [x] Route test: `GET /backtests/{id}` returns `skippedSymbols`. Migration round trip passes.
- [x] `docker compose run --rm backend-check` and `pnpm review:check` pass.

## Out of scope
- Showing the list in Orbit (NOVA-136); changing the New backtest form; downloads; rotation logic changes.

## Questions
_(implementer writes here if blocked)_

## Handoff
**Done:** Index runs skip members with no prices in the period and return their sorted symbols.
**Files changed:** All files listed under Files, plus this task and BOARD.md.
**Commands run:** backend-check (ruff, format, mypy, 1,203 tests) and frontend review:check
(format, lint, typecheck, 957 tests, app + Storybook builds): pass.
**Checked:** 360px / desktop / dark / light: N/A (no screen or story changes).
**New dependencies:** none.
**Maps updated:** CONTRACTS. **Guides updated:** API, DATABASE (migration 0021).
**Deviations from task:** Existing UniverseSymbolSchema is imported as SymbolSchema; Python uses Symbol.
**Known gaps:** Skipped symbols are exposed by the API; Orbit display remains NOVA-136.
Regression checks cover partial/all-missing indices, warm-up-only bars, chosen-symbol failure,
skipped-member exclusion from bySymbol, API responses, parity and migration round trips.
The NIFTY 100 mock example is run_006 (retained older version), keeping current trade fixtures consistent.
Skipped symbols are assigned after simulation, before save_result, avoiding progress row-lock contention.

## Review
_(reviewer — Claude or ChatGPT, ≤ 20 lines — see `docs/templates/REVIEW.md`)_
