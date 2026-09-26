# NOVA-105 — Backtest service: versions, delete, slim history (D60, migration 0015)

**Status:** done · **Owner:** Claude · **Branch:** task/NOVA-105 · **Depends on:** NOVA-104

## Goal
The backtest service stores backtests as version chains, queues an edited version, deletes backtests or old
versions, and trims older completed versions to their summary when a newer one completes.

## Read first
- `AGENTS.md`; `docs/DECISIONS.md` D60; `docs/CONTRACTS.md` (BacktestRun, BacktestVersion, delete bodies)
- `backend/services/backtest/src/nova_backtest/{routes,convert,strategy_engine}.py`, `tests/test_api.py`
- `backend/libs/nova_db/src/nova_db/models/backtest.py`, `migrations/versions/rev0014_backtest_progress.py`

## Files
Create:
- `backend/libs/nova_db/src/nova_db/migrations/versions/rev0015_backtest_versions.py`
- `backend/services/backtest/src/nova_backtest/versions.py`, `tests/test_versions.py`
Modify:
- `backend/libs/nova_db/src/nova_db/models/backtest.py`, `tests/test_migrations.py` (head `0015`)
- `backend/services/backtest/src/nova_backtest/{routes,convert,strategy_engine}.py`, `tests/{test_api,test_engine}.py`
- `docs/guides/{API,DATABASE}.md`

## Build
1. Migration `0015`: `backtest_runs.root_id` text not null (backfill `= id`), `version` int not null default 1,
   `report_kept` bool not null default true; unique (`root_id`, `version`); check `version ≥ 1`. The audit
   `action` check gets `backtest.delete`, `backtest.edit`. Downgrade deletes runs with version > 1, then drops them.
2. `GET /backtests`: only rows with no newer version of the same `root_id`. `POST /backtests` sets `root_id = id`.
3. `versions.py`:
   - `list_versions(db, run_id)` → `BacktestVersion[]` newest first (metrics from `backtest_results` when completed).
   - `add_version(db, run_id, body, caller)` → next version, `queued`, same `strategy_id`; 400 "Wait for the
     running version to finish" if any version is queued or running; unknown symbols 400 as in `POST /backtests`;
     audit `backtest.edit` "Queued v3 of backtest <name>".
   - `delete_runs(db, ids, caller)` → whole chains of those runs; `delete_version(db, id, caller)` → one old
     version (400 "Delete the whole backtest instead" for the newest). 400 "A running backtest cannot be deleted"
     if any target is `running`. Trades and results go with the runs (FK cascade). Audit `backtest.delete`
     ("Deleted backtest <name> (3 versions)"). Return `BacktestDeleteResult`.
4. Routes: `GET /backtests/{id}/versions`, `POST /backtests/{id}/versions` (201), `DELETE /backtests/{id}?scope=all|version`,
   `POST /backtests/delete`. 404 for an unknown id.
5. `strategy_engine` final commit (same transaction): older `completed` versions of the chain with `report_kept`
   → delete their trades, set result `equity_curve = []`, `by_symbol = []`, run `report_kept = false`.
6. API.md (the four endpoints, list = newest versions, slim history), DATABASE.md (columns, migration 0015).

## Acceptance checks
- [ ] pytest: an edit queues v2 (audit row); a second edit while v2 is queued → 400; the list shows only v2.
- [ ] pytest: v2 completes → v1 has no trades, an empty curve, `reportKept=false`, metrics unchanged; v2 is full.
- [ ] pytest: delete all removes every version + trades + results; deleting a running run is 400; bulk delete of
      two backtests; `scope=version` on the newest is 400, on v1 removes only v1. Parity on every response.
- [ ] Owner stack: migrate; old runs are v1 of their own chains.
- [ ] Definition of done in `AGENTS.md` §9.

## Out of scope
- Strategy stats `byVersion` (106). Orbit screens (107). Cancelling a running run.

## Questions

## Handoff
Done. Migration `0015` (`root_id` backfilled to `id`, `version`, `report_kept`, unique (root_id, version), check
`(version = 1) = (root_id = id)`, audit actions). `versions.py`: list/add/delete/trim; routes for the four endpoints;
list shows newest versions only; engine trims older completed versions in its final commit.
- `BacktestRun.root_id` has a Python-side default (= own `id`), so older code/tests that create runs still work.
- `test_versions.py` has its own small data fixture (test modules cannot import each other here).
- `test_constraints.py`: the "bad audit action" example was `backtest.delete`, now valid; changed to `order.place`.
Guides: API, DATABASE.

## Review
Built and reviewed by Claude. `backend-check` 698 passed; `pnpm review:check` passed. Merged.
