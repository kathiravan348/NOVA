# NOVA-087 — Atlas: sync all NSE stocks + indices as a job; daily auto-sync

**Status:** planned · **Owner:** — · **Branch:** task/NOVA-087 · **Depends on:** NOVA-084, NOVA-085, NOVA-086

## Goal
"Sync with Kite" queues an `instrument_sync` job that brings in every NSE stock, marks new listings, and
fills index membership and sectors from NSE. The worker also queues it each weekday morning (D56).

## Read first
- `AGENTS.md`, `docs/DECISIONS.md` D41, D54, D56
- `backend/services/atlas/src/nova_atlas/{universe,universe_api,worker,jobs,broker_client,download}.py`
- `backend/services/atlas/tests/{conftest,test_universe,test_universe_api,test_queue_worker}.py`

## Files
Create:
- `backend/services/atlas/src/nova_atlas/sync_job.py`, `tests/test_sync_job.py`
Modify:
- `backend/services/atlas/src/nova_atlas/{universe,universe_api,worker,broker_client,settings}.py`
- `backend/services/atlas/tests/{conftest,test_universe,test_universe_api,test_queue_worker}.py`
- `docs/guides/{API,USER-GUIDE}.md`

## Build
1. `broker_client`: `constituents(file)` and `session()` for the 086 endpoints.
2. `run_instrument_sync(db, job_id, broker)` (progress: 10% after the Kite lists, then per index file):
   - Kite NSE list: stocks per D56 (1); index tokens from rows with segment `INDICES` matched on `kite_symbol`.
   - For each `market_indices` row: fetch members; on `NseError` keep old membership, note the index.
     Set `member_count`, `updated_at`; sector = first index file's industry for that symbol.
   - Upsert `universe` (name, sector unless the Owner edited it — keep a non-`Unclassified` hand-set sector; indices
     = all indices listing the symbol) and `instruments` (token, lot size, as today). New symbol → `new_listing`
     true only if an earlier `instrument_sync` job is `completed`.
   - `rows_written` = stocks upserted; `summary` e.g. "2,431 stocks, 3 new listings (ABC, DEF, GHI); 2 missing; NSE file failed: NIFTY MEDIA".
   - Kite not logged in → fail with the NOVA-084 message. Audit `instrument.sync` with the summary.
3. `POST /market-data/instruments/sync` → 202 `DataJob` (400 if one is already queued/running).
   `GET /market-data/indices` → `MarketIndex[]`. `POST /market-data/universe/{symbol}/clear-new` → 200, audit `instrument.clear_new`.
   Universe write bodies: each index must exist in `market_indices` (400 otherwise). `GET /market-data/universe`
   gains `?q=` (symbol/name contains), `?index=`, `?new=true`, and cursor paging (same pattern as data jobs).
4. Worker: `instrument_sync` in `WORKER_TYPES`. On each idle loop, if weekday, IST time ≥ 08:45, `session().loggedIn`,
   and no `instrument_sync` job created today (IST) that is queued, running or completed → queue one (created by `system`).
   Check at most once a minute.

## Acceptance checks
- [ ] pytest with a fake broker: 5 stocks + bond + SGB rows → 5 synced; second sync with a 6th stock → it is `new_listing`.
- [ ] pytest: one NSE file fails → job completes, summary names it, old membership kept.
- [ ] pytest: scheduler queues once at 08:45 IST on a weekday when logged in; not on Saturday, not when logged out, not twice.
- [ ] pytest: every new/changed endpoint (success, 400, 404, audit).
- [ ] Definition of done in `AGENTS.md` §9.

## Out of scope
- Screens (088, 089). Downloading index candles. Deleting delisted stocks. Exchanges other than NSE.

## Questions

## Handoff

## Review
