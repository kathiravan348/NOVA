# NOVA-101 — Backtest progress: stage, counts and percent on each run (migration 0014)

**Status:** done · **Owner:** Claude · **Branch:** task/NOVA-101 · **Depends on:** NOVA-100

## Goal
While a backtest runs, `GET /backtests/{id}` (and the list) reports what it is doing: stage, stocks loaded,
bars simulated, the date reached, trades so far and a percent (D58). The UI part is NOVA-102.

## Read first
- `AGENTS.md`; `docs/DECISIONS.md` D58
- `backend/services/backtest/src/nova_backtest/{engine,worker,strategy_engine,simulate,routes}.py`
- `backend/libs/nova_db/src/nova_db/models/backtest.py`; `frontend/packages/contracts/src/backtest.ts`

## Files
Create:
- `backend/libs/nova_db/src/nova_db/migrations/versions/rev0014_backtest_progress.py`
- `backend/services/backtest/src/nova_backtest/progress.py`, `tests/test_progress.py`
Modify:
- `backend/libs/nova_db/src/nova_db/models/backtest.py`, `tests/test_migrations.py` (head `0014`)
- `backend/services/backtest/src/nova_backtest/{engine,worker,strategy_engine,simulate,routes}.py`, `tests/{test_worker,test_engine,test_api}.py`
- Contracts: `BacktestRun` (Zod `backtest.ts` + test, Pydantic `nova_contracts/backtest.py` + parity, generated schema); mocks `backtestRuns.json`
- `docs/guides/{API,DATABASE}.md`, `docs/CONTRACTS.md`

## Build
1. Migration `0014`, `backtest_runs` columns: `stage` text null (check `loading|signals|simulating|saving|done`),
   `progress_percent` smallint not null default 0 (0–100), `symbols_done`, `symbols_total`, `bars_done`,
   `bars_total`, `trades_so_far` int not null default 0 (≥ 0), `simulated_to` date null (IST date reached).
2. Contract: `BacktestRun.progress` = `null` while never started, else `BacktestProgress {stage, percent,
   symbolsDone, symbolsTotal, barsDone, barsTotal, tradesSoFar, simulatedTo (IsoDate|null)}`.
   Refine: `completed` ⇒ `progress.stage = "done"` and `percent = 100`. A failed run keeps its last progress.
3. `progress.py`: `Progress(session_factory, run_id, clock)` with `stage(name, total=0)` and
   `advance(done, simulated_to=None, trades=None)`. Writes one `UPDATE backtest_runs` in **its own session**
   (the engine's transaction stays open until the final commit), at most once per second, always on a stage change.
   Percent bands: loading 0–20 (per stock), signals 20–30 (Python only, one step), simulating 30–95 (per bar
   event), saving 95–100. `NullProgress` for tests.
4. `BacktestEngine.run(db, run_id, progress)`; the worker builds `Progress` from its session factory.
   `StrategyEngine`: `loading` resets all counts and advances after each stock; `signals` around `run_python`;
   `simulate(..., on_bar=None)` calls `on_bar(done, ts, trade_count)` every 1,000 events and at the end;
   `saving` before writing trades; the final commit sets `stage='done'`, `progress_percent=100`.
5. `routes.py` maps the columns to `progress` (null when `stage` is null).

## Acceptance checks
- [ ] pytest: a run over 3 stocks writes `loading` 3/3, then `simulating` with `bars_total` = all bar events,
      then `done` 100%; a Python run passes through `signals`; a failed run keeps its last stage and percent.
- [ ] pytest: with a fake clock, 10,000 `advance` calls inside one second give one UPDATE.
- [ ] Vitest + parity: `BacktestRun` with `progress` parses; a `completed` run with 40% fails the schema.
- [ ] Definition of done in `AGENTS.md` §9.

## Out of scope
- Orbit screens (NOVA-102). WebSocket events for runs (screens poll). Cancelling a running backtest.
- Worker memory limits for big 1m universes.

## Questions

## Handoff
Done. Migration `0014` (+ `BACKTEST_STAGES`; completed runs backfilled to `done`/100), `progress.py`
(`Progress`, `NullProgress`, `ProgressSink`), engine/worker/simulate wiring, `BacktestProgress` contract
(Zod + Pydantic + schema + mocks + MSW POST), API/DATABASE/CONTRACTS docs.
- Mapping to the contract lives in `convert.run_contract` (routes use it), not `routes.py`.
- `nova_contracts/__init__.py` exports `BacktestProgress`, `BacktestStage`.
- Owner stack: a 20-stock 1m SMA run (1.41 M bars) moved loading 0→16%, simulating 39→83% with
  `simulated_to` advancing, then `done` 100% (516 trades). Test run deleted.
Guides: API, DATABASE.

## Review
Built and reviewed by Claude. `backend-check` 691 passed; `pnpm review:check` passed. Merged.
