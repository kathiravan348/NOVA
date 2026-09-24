# NOVA-054 — Strategy service: strategies CRUD, immutable versions, stats summary

**Status:** done · **Owner:** Claude · **Branch:** task/NOVA-054 · **Depends on:** NOVA-048

## Goal
The strategy service stores strategies with immutable versions (Strategy Spec JSON, D9, D25), serves the frozen read
endpoints and the stats summary computed in SQL (D26), and adds three write endpoints the editor needs (D43).

## Read first
- `AGENTS.md` (§7, §8), `docs/DECISIONS.md` (D9, D25, D26, D37, D38, D43)
- `frontend/packages/contracts/src/{strategy.ts,strategyStats.ts}`, `frontend/packages/mocks/data/{strategies,strategyStats}.json`
- `backend/services/atlas/src/nova_atlas/{main.py,jobs.py}` (service pattern), `nova_db/models/{strategy.py,backtest.py}`

## Files
Contracts (TS): `contracts/src/{strategy.ts,strategy.test.ts,jsonSchema.test.ts}`, `schema/{StrategyCreate,StrategyVersionCreate,StrategyUpdate}.json`;
mocks `src/handlers/{orbit.ts,orbit.test.ts}`
Contracts (Py): `nova_contracts/{strategy.py,strategy_stats.py,__init__.py}` + `tests/{test_strategy.py,test_strategy_stats.py}`
Service (create): `backend/services/strategy/{pyproject.toml,src/nova_strategy/{__init__.py,py.typed,settings.py,main.py,routes.py,stats.py},tests/*}`
Also: `backend/pyproject.toml`, `uv.lock`, `compose.yaml`, `docs/{CONTRACTS,DECISIONS,STRUCTURE}.md`

## Build
1. Zod: `StrategyCreate { name, description, spec }`, `StrategyVersionCreate { note, spec }`, `StrategyUpdate { name?,
   description?, status? }` (at least one field). MSW handlers answer with a `Strategy` built from the body (no state).
2. Pydantic mirrors of the whole spec tree (operands, conditions, rule groups, sizing, risk, both modes), `StrategyVersion`,
   `Strategy` (latestVersion = max version), `StrategyStats` (all refinements), the three write bodies; parity vs mocks.
3. Routes (internal caller, D38): `GET /strategies` (created order), `GET /strategies/{id}`, `GET /strategies/stats`
   (one row per strategy), `POST /strategies` (version 1, `draft`), `POST /strategies/{id}/versions` (latest + 1,
   immutable), `PATCH /strategies/{id}`. Writes audit `strategy.create` / `strategy.update`.
4. Stats (one SQL query): run counts by status (queued + running = in progress), last run, best/worst return, win-rate
   min/max, worst drawdown, best net P&L run — result fields only from completed runs with results.

## Acceptance checks
- [x] Tests: create → version → update flow, 404/400, audit rows, stats on seeded runs (incl. none completed), schema
      parity for every response. `backend-check` + `pnpm review:check` pass.

## Out of scope
- Editor/screens on the real API (059), deleting strategies, spec semantics beyond the contract, Python sandbox (057).

## Handoff
**Done:** Built by Claude on Owner request (2026-09-25). Write contracts (TS + Py + schemas + mock handlers), strategy service.
**Commands run:** `backend-check` pass (258 tests); `pnpm review:check` pass (92 files); e2e through Core: create → list
(draft, v1) → stats (zero runs). Test rows removed.
**New dependencies:** none.
**Deviations:** `nova_common.internal.CallerDep` (shared; Atlas now uses it too). Specs are stored as wire JSON (camelCase).
**Known gaps:** no delete (D43); the editor still shows its demo toast until NOVA-059.

## Review
**Result:** done
**Fixed directly:** new versions lock the strategy row (`FOR UPDATE`) so two saves cannot take the same number;
update code simplified; test typing for a list of model classes.
**Rulebook issues found:** none. **Follow-up tasks created:** none.
