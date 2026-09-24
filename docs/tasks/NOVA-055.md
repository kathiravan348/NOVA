# NOVA-055 — Backtest service: queue runs, runs/results/trades API, worker

**Status:** done · **Owner:** Claude · **Branch:** task/NOVA-055 · **Depends on:** NOVA-053, NOVA-054, NOVA-061

## Goal
Backtests can be queued (`POST /backtests`, D44) and read back through the frozen endpoints (runs, result, trades,
paged per D32), and a worker claims queued runs from the Postgres queue (D41) and hands them to an engine. The engine
itself is NOVA-062; until then the worker fails runs with a clear message.

## Read first
- `AGENTS.md` (§7, §8), `docs/DECISIONS.md` (D25, D32, D37, D41, D44), `frontend/packages/contracts/src/{backtest,trade}.ts`
- `backend/services/atlas/src/nova_atlas/{queue.py,worker.py,jobs.py}`, `backend/services/strategy/` (service pattern)

## Files
TS: `contracts/src/{backtest.ts,backtest.test.ts,jsonSchema.test.ts}`, `schema/BacktestRunCreate.json`, mocks `handlers/{orbit.ts,orbit.test.ts}`
Py contracts: `nova_contracts/{backtest.py,trade.py,__init__.py}` + `tests/test_backtest.py`
Shared: `nova_db/{queue.py,paging.py}` (queue moved from Atlas; `ascending` pages), Atlas `{queue.py→removed,worker.py,tests}`
Create: `backend/services/backtest/{pyproject.toml,src/nova_backtest/{__init__.py,py.typed,settings.py,main.py,routes.py,
convert.py,engine.py,worker.py,cli.py,__main__.py},tests/*}`
Also: `backend/pyproject.toml`, `uv.lock`, `compose.yaml` (`backtest`, `backtest-worker`), `docs/{CONTRACTS,DECISIONS,STRUCTURE,PLAN}.md`, BOARD

## Build
1. Zod `BacktestRunCreate { strategyId, strategyVersion, name, universe, from, to, initialCapitalPaise, benchmark }`
   (from ≤ to); MSW `POST /backtests` answers a `queued` run built from the body. Pydantic mirrors of `BacktestRun`,
   `BacktestResult` (metrics, equity points, per-symbol), `Trade`, `BacktestRunCreate`; parity vs mocks.
2. `nova_db.queue`: `claim_next(db, table)` / `requeue_running(db, table)` for `DataJob` and `BacktestRun`; Atlas uses it.
   `nova_db.paging.newest_first` gains an `ascending` twin (`oldest_first`) for trades.
3. Routes (internal caller): `GET /backtests?strategyId&limit&cursor` (newest first), `/backtests/{id}`,
   `/backtests/{id}/result` (404 until completed), `/backtests/{id}/trades` (oldest first, paged), `POST /backtests`
   (strategy + version must exist → 404/400; audit `backtest.run`; 201 queued run).
4. Worker: claim → `engine.run(db, run_id)`; an engine error marks the run `failed` with a short message. v0 engine
   raises "Backtest engine arrives in NOVA-062". `python -m nova_backtest worker`.

## Acceptance checks
- [x] Tests: queue → claim → failed (v0), paging both directions, 404s, strategyId filter, schema parity, audit.
- [x] `backend-check` + `pnpm review:check` pass.

## Out of scope
- The engine (062), intraday (056), Python mode (057), cancelling runs, the run form on the real API (059).

## Handoff
**Done:** Built by Claude on Owner request (2026-09-25). Run queueing + read APIs, shared queue/paging, worker with v0 engine.
**Commands run:** `backend-check` pass (282 tests); `pnpm review:check` pass (92 files); e2e through Core: create strategy →
queue run (201) → worker fails it "Backtest engine arrives in NOVA-062" → stats show 1 failed. Test rows removed.
**New dependencies:** none.
**Deviations:** `IsoDate` now parses `YYYY-MM-DD` strings in Python mode (FastAPI validates bodies that way; strict mode
refused them) — only that exact format is accepted. Symbol universes are checked against `instruments` when queued.
**Known gaps:** no cancel; engine in NOVA-062.

## Review
**Result:** done
**Fixed directly:** request bodies with dates were rejected (strict mode) → `IsoDate` before-validator + test; queue
row type narrowed for mypy; `_drain` typed with the engine protocol instead of an ignore.
**Rulebook issues found:** none. **Follow-up tasks created:** NOVA-062 (engine).
