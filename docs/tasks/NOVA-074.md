# NOVA-074 — Atlas: universe in the database + sync over HTTP

**Status:** done · **Owner:** Claude · **Branch:** task/NOVA-074 · **Depends on:** NOVA-072

## Goal
The stock list lives in a `universe` table (seeded from `universe.csv`, then the file is deleted) and is
listed, added, edited, removed and synced with Kite over HTTP, audited (D54). No screen yet (075).

## Read first
- `AGENTS.md`, `docs/DECISIONS.md` D41, D54
- `backend/services/atlas/src/nova_atlas/{universe,cli,jobs}.py`, `data/universe.csv`
- `backend/libs/nova_db/src/nova_db/{enums.py,models/data.py}`, `migrations/versions/rev0005_audit_account_create.py`

## Files
Create:
- `backend/libs/nova_db/src/nova_db/migrations/versions/rev0006_universe.py`
- `backend/services/atlas/src/nova_atlas/universe_api.py`, `tests/test_universe_api.py`
- `frontend/packages/contracts/src/universe.ts`, `universe.test.ts`; `schema/{UniverseEntry,UniverseEntryWrite,InstrumentSyncResult}.json` (generated)
- `backend/libs/nova_contracts/src/nova_contracts/universe.py`, `tests/test_universe.py`
Modify:
- `backend/libs/nova_db/src/nova_db/{enums.py,models/data.py,models/__init__.py}`, `tests/test_migrations.py`
- `backend/libs/nova_contracts/src/nova_contracts/{audit,__init__}.py`; `frontend/packages/contracts/src/{audit,index,jsonSchema.test}.ts`
- `backend/services/atlas/src/nova_atlas/{universe,cli,jobs,main}.py`, `tests/test_universe.py`
- Delete `backend/services/atlas/src/nova_atlas/data/universe.csv`
- `backend/README.md`, `docs/guides/{API,DATABASE}.md`, `docs/CONTRACTS.md`, `docs/STRUCTURE.md`

## Build
1. Migration 0006: table `universe` — PK (`exchange` default `NSE`, `symbol`), `name`, `sector`, `indices`
   text[] (CHECK each ∈ INDEX_NAMES), `created_at`, `updated_at`. Insert the 24 current rows as frozen literals.
   Audit actions `instrument.add`, `instrument.update`, `instrument.remove`, `instrument.sync`; target type `instrument`.
2. Contracts: `UniverseEntry {symbol, name, sector, indices, synced}` (`synced` = instrument has a Kite token);
   `UniverseEntryWrite {symbol, name, sector, indices}`: symbol `^[A-Z0-9&-]{1,20}$`, name/sector 1–80 chars,
   indices ⊆ index names; `InstrumentSyncResult {synced: string[], missing: string[]}`. Zod + Pydantic + parity.
3. `load_universe(db)` reads the table (sorted by symbol); `queue_download` and `sync_instruments` use it.
4. `universe_api.py` under `/market-data/universe`: GET list; POST → 201 (400 duplicate symbol); PUT
   `/{symbol}` (symbol in body must match path) → 200; DELETE `/{symbol}` → 204, 400 if a queued/running
   job uses it. Removing does not delete candles or the `instruments` row. 404 for unknown symbols.
5. `POST /market-data/instruments/sync` → 200 `InstrumentSyncResult`; `BrokerDataError` → 400 with its
   message (e.g. not logged in). Audit `instrument.sync` "Synced 23; missing: XYZ".
6. CLI `sync-instruments` unchanged in use; replace every mention of `universe.csv` in the listed docs
   and code comments with the `universe` table.

## Acceptance checks
- [ ] Migration up/down test passes; after upgrade the table has the 24 symbols.
- [ ] pytest: every endpoint's success, 400, 404 and audit row; sync with the fake broker; delete blocked by a queued job.
- [ ] `grep -r universe.csv backend` finds nothing.
- [ ] Definition of done in `AGENTS.md` §9.

## Out of scope
- Relay screens (075). Other exchanges than NSE. Importing a CSV from the screen.

## Questions

## Handoff
Built by Claude at the Owner's request. All acceptance checks pass.
- Migration 0006: `universe` table seeded with the 24 stocks; audit actions `instrument.add|update|remove|sync`
  (one `instrument` prefix so Relay's audit filter groups them) and target type `instrument` (id = symbol).
- `universe.py` reads the table (`load_universe(db)`, sorted by symbol); `universe.csv` deleted.
- `universe_api.py`: list/add/update/remove + `POST /market-data/instruments/sync`; `create_app` takes a
  `broker_factory` (tests pass the fake broker).
- Also touched (not listed): `frontend/apps/nova-relay/src/lib/labels.ts` (labels + **Instruments** audit group,
  required by the `Record<AuditAction>` type), atlas `conftest.py` (restores the seeded list), `test_download.py`.
- Checks: `pnpm review:check` green (655); backend lint/types clean, pytest per package green (465).
- Guides: API, DATABASE (0006), CONTRACTS, STRUCTURE, backend README.

## Review
Self-reviewed. Real mode needs `docker compose build` + `up -d` so `migrate` reaches 0006.
