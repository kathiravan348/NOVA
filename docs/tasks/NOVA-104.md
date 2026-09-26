# NOVA-104 — Contracts, mocks and services for backtest versions and delete (D60)

**Status:** done · **Owner:** Claude · **Branch:** task/NOVA-104 · **Depends on:** NOVA-102

## Goal
The wire shapes of D60 exist in Zod and Pydantic, mocks and MSW serve them, and `@nova/services` has hooks,
so the backend (105, 106) and Orbit (107, 108) build against one contract.

## Read first
- `AGENTS.md`; `docs/DECISIONS.md` D60
- `frontend/packages/contracts/src/{backtest,strategyStats,audit}.ts`; `backend/libs/nova_contracts/src/nova_contracts/{backtest,strategy_stats,audit}.py`
- `frontend/packages/mocks/src/handlers/orbit.ts`, `orbit.consistency.test.ts`; `frontend/packages/services/src/{api,queries}/orbit.ts`

## Files
Modify:
- Contracts: `backtest.ts`, `strategyStats.ts`, `audit.ts` (+ their tests, `jsonSchema.test.ts`, `schema/*.json` via `schema:update`)
- `backend/libs/nova_contracts/src/nova_contracts/{backtest,strategy_stats,audit,__init__}.py` + tests
- `backend/libs/nova_db/src/nova_db/enums.py` (`AUDIT_ACTIONS` + `backtest.delete`, `backtest.edit`; the migration is 105)
- Mocks: `data/{backtestRuns,backtestResults,strategyStats}.json`, `src/handlers/orbit.ts` (+ test), `src/orbit.consistency.test.ts`
- Services: `api/orbit.ts`, `queries/{orbit,keys}.ts`, `queries/queries.test.tsx`
- `docs/CONTRACTS.md`

## Build
1. `BacktestRun` + `rootId` (Id), `version` (int ≥ 1), `reportKept` (bool). Refine: `version = 1` ⇔ `rootId = id`.
2. `BacktestVersion {runId, version, status, strategyVersion, name, universe, from, to, initialCapitalPaise,
   benchmark, createdAt, error, reportKept, metrics: BacktestMetrics | null}` (metrics only when completed).
3. `BacktestVersionCreate` = `BacktestRunCreate` without `strategyId`. `BacktestDeleteRequest {ids: Id[] 1–100}`,
   `BacktestDeleteResult {deletedRuns: int ≥ 0}`.
4. `StrategyStats.byVersion: {version, runsCompleted, bestReturnPercent|null, bestRunId|null}[]` (one row per
   strategy version, ascending; best fields null when `runsCompleted = 0`).
5. `AuditAction` + `backtest.delete`, `backtest.edit` (Zod, Pydantic, `enums.py`).
6. Mocks: every run gets the new fields; add `run_006` = v1 of the backtest whose v2 is `run_002`
   (`run_002.rootId = run_006`); `run_006` completed, `reportKept: false`, a result with metrics and empty
   `equityCurve`/`bySymbol`, no trades. Consistency tests skip trade/curve/bySymbol checks when `reportKept` is false.
7. MSW: `GET /backtests` lists only the newest version per `rootId`; `GET /backtests/:id/versions` (newest first);
   `POST /backtests/:id/versions` → 201 queued next version; `DELETE /backtests/:id?scope=all|version` and
   `POST /backtests/delete` → `BacktestDeleteResult` (400 when a target is running, or `scope=version` on the
   newest). Nothing is stored (demo).
8. Services: `listBacktestVersions`, `addBacktestVersion`, `deleteBacktest(id, scope)`, `deleteBacktests(ids)`;
   hooks `useBacktestVersions`, `useAddBacktestVersion`, `useDeleteBacktest`, `useDeleteBacktests`; mutations
   invalidate `backtests.all` and `strategies.stats`. Key `backtests.versions(id)`.

## Acceptance checks
- [ ] Zod tests + Pydantic parity for every new/changed contract against the mocks; a v2 run with `rootId = id` fails.
- [ ] MSW handler tests: the list hides `run_006`; versions of `run_002` = [2, 1]; deleting a running run is 400.
- [ ] Services tests for the four hooks (paths, bodies, invalidation).
- [ ] Definition of done in `AGENTS.md` §9.

## Out of scope
- Backend endpoints and migration (105, 106); Orbit screens (107, 108).

## Questions

## Handoff
Done. Contracts (Zod + Pydantic + schema files): `BacktestRun.rootId/version/reportKept`, `BacktestVersion`,
`BacktestVersionCreate`, `BacktestDeleteRequest/Result`, `StrategyStats.byVersion` (`VersionStats`), audit actions
`backtest.edit`/`backtest.delete`. Mocks: `run_006` = slim v1 of `run_002`; consistency tests skip slim runs and check
`byVersion`. MSW: newest-only list, versions, add version, delete (one/all/bulk). Services: 4 API functions + hooks
(`useDeleteBacktest` forgets a deleted backtest's cached pages instead of refetching them into a 404).
- Extra files touched: `services/src/api/api.test.ts` (list = newest versions), `ui-trading` StrategyCard story/test
  and Relay `labels.ts` (new audit labels), `strategies.test.tsx` (worst return now includes `run_006`).
- Merged together with 105 and 106: the new required contract fields break the services until both exist.
Guides: none (CONTRACTS.md updated).

## Review
Built and reviewed by Claude. `backend-check` 698 passed; `pnpm review:check` passed. Merged.
