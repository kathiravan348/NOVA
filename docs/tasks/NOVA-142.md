# NOVA-142 — Benchmark: any index, defaulting to the universe's index

**Status:** done · **Owner:** Claude · **Branch:** task/NOVA-142 · **Depends on:** —

## Goal
A backtest can be compared with any stored index (e.g. NIFTY 500 for a NIFTY 500 universe), not only NIFTY 50
(D72 (1)–(2)). Unknown names answer 400 and the database refuses them.

## Read first
- `AGENTS.md`; `docs/DECISIONS.md` rows D62 and D72; the files below.

## Files
Create:
- `backend/libs/nova_db/src/nova_db/migrations/versions/rev0023_any_benchmark.py`
Modify:
- `backend/libs/nova_db/src/nova_db/{enums.py,models/backtest.py}`, `backend/libs/nova_db/tests/{test_constraints.py,test_migrations.py}`
- `backend/libs/nova_contracts/src/nova_contracts/backtest.py`, `backend/libs/nova_contracts/tests/test_backtest.py`
- `backend/services/backtest/src/nova_backtest/{routes.py,versions.py}`, `backend/services/backtest/tests/{test_api.py,test_versions.py}`
- `frontend/packages/contracts/src/{backtest.ts,backtest.test.ts}`, `frontend/packages/contracts/schema/*.json` (generated)
- `frontend/apps/nova-orbit/src/pages/backtests/{backtestForm.ts,backtestForm.test.ts,NewBacktestPage.tsx,UniverseFields.tsx,backtests.test.tsx}`
- `docs/guides/{API.md,DATABASE.md,USER-GUIDE.md}`, `docs/tasks/{BOARD.md,NOVA-142.md}`

## Build
1. Migration 0023: drop `ck_backtest_runs_benchmark`; add FK `backtest_runs.benchmark` → `market_indices.name`
   (null allowed). Remove `BENCHMARKS` from `enums.py` and the check from the model; add the FK there.
2. Contracts: `BacktestBenchmark` = `IndexName` (Python, `market_data.py`) / `IndexNameSchema` (TS). Library
   contracts reuse the type and need no edit. Re-run `schema:update`.
3. `versions.py`: `check_benchmark(db, name)` next to `check_symbols`: 400 `invalid_request`
   "Unknown benchmark: X" when the name is not in `market_indices`. Call it from `POST /backtests` and
   `POST /backtests/{id}/versions` before insert. Tests for both endpoints, plus a known non-NIFTY-50 index.
4. Form: `benchmark` becomes a string (`""` = none). Replace the **Compare with NIFTY 50** switch with a
   **Benchmark** select: **None** + every index (export and reuse `indexOptions` from `UniverseFields.tsx`).
   New form default `"NIFTY 50"`. While the user has not changed **Benchmark** (RHF dirty state), picking
   **A whole index** as the universe, or another index, sets the benchmark to that index. Edit keeps the run's
   value. URL param `benchmark=<index name>|none` (Library link) is checked with `IndexNameSchema`.
5. Guides: API (`POST /backtests`, `/versions`: any stored index, 400), DATABASE (FK, migration 0023),
   USER-GUIDE Step "Run a backtest" (the **Benchmark** field and its default).

## Acceptance checks
- [x] Queueing with `NIFTY 500` saves it; the result shows NIFTY 500's return and the year table's column.
- [x] `SENSEX` (not in `market_indices`) → 400 from both endpoints; a direct insert fails on the FK.
- [x] Form tests: default NIFTY 50; choosing index NIFTY 100 sets it; a changed choice is kept; None → `null`.
- [x] Migration upgrade/downgrade test passes with existing `NIFTY 50` and `null` rows.
- [x] Definition of done in `AGENTS.md` §9 (backend-check and `pnpm review:check`).

## Out of scope
- Library data (`library/*.json` keep NIFTY 50), result metrics, benchmark maths, strategy stats (NOVA-143).
- Re-running or editing existing runs; the runs queued today stay as they are.

## Questions
- Full frontend check: `frontend/apps/nova-orbit/src/pages/library/library.test.tsx:86` still expects
  the removed switch. Owner approved updating that assertion in this session (file absent from scope).

## Handoff
- Built by ChatGPT, 28 Sep 2026, branch `task/NOVA-142`; independent review required.
- Changed: migration 0023 + model FK, Python/TS benchmark contracts + five generated schemas,
  both queue endpoints, Orbit benchmark select/defaults, tests, and the three guides.
- Any stored index is accepted; unknown names return 400 `invalid_request` before insert.
- Defaults follow the universe until Benchmark is dirty; explicit NIFTY 50, None, Library links,
  and existing run values are preserved. Automatic defaults reset RHF's benchmark baseline.
- Tests: targeted frontend 55 passed; targeted backend 102 passed.
- Gates: `pnpm review:check` passed (986 tests; lint, typecheck, formatting, Orbit/Relay/Storybook builds).
- `docker compose run --rm backend-check` passed (1225 tests; ruff, format, strict mypy).
- First full backend run hit an unrelated WebSocket teardown cancellation; unchanged rerun passed.
- Visual QA: run form at 360px and 1440px, dark/light; reused existing ui-core Select stories.
- Guides: API, DATABASE (0023), USER-GUIDE updated; no new dependencies.
- Maps: none (no new contract fields, endpoints or components).
- Owner approved the one-line Library test update outside the original Files list (see Questions).
- Downgrade preserves runs but clears non-NIFTY-50 benchmarks to null for the old constraint.
- No live migration applied. Reviewer must merge; no self-review performed.

## Review
**Result:** done
**Reviewer / built by:** Claude / ChatGPT. **Self-review:** no.
**Fixed directly (review: commits):**
- `EquityCurve` legend, line name and tooltip were hardcoded "NIFTY 50": new `benchmarkLabel` prop (default
  NIFTY 50), passed the run's benchmark on the result and compare pages; test + `OtherIndex` story.
- `NewBacktestPage.tsx`: doc comments and blank lines had been stripped to stay ≤ 300 lines. Restored them and
  moved the **Benchmark** select + follow-the-index effect into `BenchmarkField.tsx` (295 lines now).
- `docs/COMPONENTS.md` EquityCurve row; USER-GUIDE result-page **Equity curve** line (named after the index).
**Change requests:** none.
**Guides checked:** API, DATABASE match the diff; USER-GUIDE fixed directly (equity curve line).
**Rulebook issues found:** §8 files ≤ 300 lines was met by deleting comments instead of splitting the file.
Gates: `pnpm review:check` (988 tests) and `backend-check` (1,225 tests) pass after the fixes.
**Follow-up tasks created:** none.
