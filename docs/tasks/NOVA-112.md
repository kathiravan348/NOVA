# NOVA-112 — Delete strategy: endpoint, audit, Orbit button (D62, migration 0016)

**Status:** planned · **Owner:** — · **Branch:** task/NOVA-112 · **Depends on:** —

## Goal
The Owner can delete a strategy from its Orbit page. This removes every version and every backtest of it
(results and trades too), after a confirm (D62 (1), which changes D43's "no delete").

## Read first
- `AGENTS.md`; `docs/DECISIONS.md` D43, D60, D62; every file under Files

## Files
Create:
- `backend/libs/nova_db/src/nova_db/migrations/versions/rev0016_strategy_delete.py`
- `frontend/apps/nova-orbit/src/pages/strategies/DeleteStrategyButton.tsx`
Modify:
- `backend/libs/nova_db/src/nova_db/enums.py`, `backend/libs/nova_contracts/src/nova_contracts/audit.py`
- `backend/services/strategy/src/nova_strategy/routes.py`, `backend/services/strategy/tests/test_strategies.py`
- `frontend/packages/contracts/src/audit.ts`, `frontend/packages/contracts/schema/AuditEntry.json` (`pnpm --filter @nova/contracts schema:update`)
- `frontend/packages/services/src/api/orbit.ts`, `frontend/packages/services/src/queries/orbit.ts`, `frontend/packages/services/src/api/api.test.ts`
- `frontend/packages/mocks/src/handlers/orbit.ts`, `frontend/packages/mocks/src/handlers/orbit.test.ts`
- `frontend/apps/nova-orbit/src/pages/strategies/StrategyDetailPage.tsx`
- `frontend/apps/nova-orbit/src/pages/backtests/DeleteBacktestButton.tsx` (export `ConfirmDelete`, add a `detail` text prop)
- `docs/guides/API.md`, `docs/guides/DATABASE.md`, `docs/guides/USER-GUIDE.md`

## Build
1. Audit action `strategy.delete`: `AUDIT_ACTIONS`, both contract enums, and migration 0016, which replaces
   `ck_audit_entries_action` the same way rev0015 does (the downgrade restores the 0015 list).
2. `DELETE /strategies/{strategy_id}` in `routes.py`:
   - Lock the strategy (`_strategy(..., lock=True)`), then select its runs `FOR UPDATE`.
   - Unknown strategy → 404, as `get_strategy` does. Any run `running` → 400 `invalid_request`,
     "Wait for the running backtest to finish".
   - Otherwise delete its `backtest_runs`, which cascades to results and trades, then the strategy, which cascades to versions.
   - Write audit `strategy.delete` (target `strategy`), summary `Deleted strategy {name} ({n} backtest runs)`, the way `update_strategy` does.
   - Answer 200 with `BacktestDeleteResult {deletedRuns: n}`.
3. Services: `deleteStrategy(id)` (`DELETE`, `BacktestDeleteResultSchema`) and `useDeleteStrategy()`. On success it
   removes `strategies.detail(id)` and invalidates `strategies.all` and `backtests.all`.
4. Mocks: a stateless `DELETE /strategies/:id` like the D60 deletes. Unknown id → 404. Any mock run of it `running` → 400.
   Otherwise `{deletedRuns: <mock runs of it>}`.
5. Orbit: a **Delete strategy** button (danger, `Trash2` icon) in the detail page header. The confirm reads
   "Delete {name}?" with the detail "This cannot be undone. All its versions and {n} backtests are deleted too."
   On success: toast "Deleted {name}", then go to the strategies list. On failure: the D60 "Could not delete" toast.
6. Guides: API §3 row; DATABASE audit action list plus migration `0016` in the header; USER-GUIDE Orbit Step 3
   (the button, and that deleting cannot be undone) and §7 row "Cannot delete: a backtest is running → wait or let it finish".
   Update "State as of" in all three.

## Acceptance checks
- [ ] pytest: delete removes the strategy, its versions, its runs, results and trades, and other strategies are untouched; the answer counts the runs.
- [ ] pytest: a `running` run → 400 with nothing deleted; a `queued` run is deleted; unknown id → 404; audit row written.
- [ ] `python -m nova_db upgrade` then `check` pass; the audit check accepts `strategy.delete` (migration test like 0015's).
- [ ] Vitest: handler (200/400/404), service schema, and page test (confirm → toast → navigates to the list; the cancel keeps it).
- [ ] Real mode: create a throwaway strategy with one backtest, then delete it. It leaves the list, the stats cards and
      the Backtests list. Do not touch the Owner's strategies; the Owner deletes those.
- [ ] Definition of done in `AGENTS.md` §9 (360px and desktop, dark and light).

## Out of scope
- Deleting several strategies at once, archiving changes, the Library (NOVA-121/122), engine changes.

## Questions
_(implementer writes here if blocked)_

## Handoff
_(implementer, ≤ 20 lines — see `docs/templates/HANDOFF.md`)_

## Review
_(Claude, ≤ 20 lines — see `docs/templates/REVIEW.md`)_
