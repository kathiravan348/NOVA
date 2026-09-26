# NOVA-085 — Indices table, open `IndexName`, new-listing flag, `instrument_sync` job type

**Status:** done · **Owner:** Claude · **Branch:** task/NOVA-085 · **Depends on:** NOVA-083

## Goal
The database and contracts for D56: indices are rows (not a fixed list of 3), stocks can be flagged as new
listings, and a data job can be an `instrument_sync` with a result summary. No sync logic yet (087).

## Read first
- `AGENTS.md`, `docs/DECISIONS.md` D54, D56
- `backend/libs/nova_db/src/nova_db/{enums.py,models/data.py}`, `migrations/versions/rev0006_universe.py`, `rev0008_kite_apps.py`
- `backend/libs/nova_contracts/src/nova_contracts/{market_data,universe,data_job}.py` (data job file: find via `docs/CONTRACTS.md`)
- `frontend/packages/contracts/src/{strategy,marketData,universe,dataJob}.ts`

## Files
Create:
- `backend/libs/nova_db/src/nova_db/migrations/versions/rev0009_market_indices.py`
- `frontend/packages/contracts/src/schema/MarketIndex.json` (generated)
Modify:
- `backend/libs/nova_db/src/nova_db/{enums.py,models/data.py,models/__init__.py}`, `tests/test_migrations.py`, `tests/test_constraints.py`
- `backend/libs/nova_contracts/src/nova_contracts/{market_data,universe,__init__}.py` + the data job contract file, their tests
- `frontend/packages/contracts/src/{strategy,marketData,universe,dataJob,index,jsonSchema.test}.ts` + their tests
- `frontend/packages/mocks/src/data.ts` (+ `handlers/marketData.ts` if a mock needs `newListing`/`summary`)
- `docs/guides/DATABASE.md`, `docs/CONTRACTS.md`

## Build
1. Migration 0009:
   - Table `market_indices`: `name` text PK (1–40 chars), `kite_symbol` text unique, `constituents_file`
     text, `instrument_token` bigint null, `member_count` int not null default 0, `updated_at` timestamptz null.
     Seed (name = kite_symbol, file): NIFTY 50 `ind_nifty50list.csv`, NIFTY NEXT 50 `ind_niftynext50list.csv`,
     NIFTY 100 `ind_nifty100list.csv`, NIFTY 200 `ind_nifty200list.csv`, NIFTY 500 `ind_nifty500list.csv`,
     NIFTY MIDCAP 100 `ind_niftymidcap100list.csv`, NIFTY SMLCAP 100 `ind_niftysmallcap100list.csv`,
     NIFTY BANK `ind_niftybanklist.csv`, NIFTY FIN SERVICE `ind_niftyfinancelist.csv`, NIFTY IT `ind_niftyitlist.csv`,
     NIFTY AUTO `ind_niftyautolist.csv`, NIFTY FMCG `ind_niftyfmcglist.csv`, NIFTY PHARMA `ind_niftypharmalist.csv`,
     NIFTY METAL `ind_niftymetallist.csv`, NIFTY REALTY `ind_niftyrealtylist.csv`, NIFTY ENERGY `ind_niftyenergylist.csv`,
     NIFTY MEDIA `ind_niftymedialist.csv`, NIFTY PSU BANK `ind_niftypsubanklist.csv`, NIFTY PVT BANK `ind_nifty_privatebanklist.csv`.
   - `universe`: drop the `indices` CHECK; add `new_listing` boolean not null default false.
   - `data_jobs`: type gains `instrument_sync`; `symbols` CHECK becomes `type = 'instrument_sync' OR cardinality(symbols) >= 1`;
     new column `summary` text null (≤ 500 chars). Audit action `instrument.clear_new`. Downgrade reverses all.
2. Contracts (Zod + Pydantic + parity): `IndexName` = string, 1–40 chars, `^[A-Z0-9 &-]+$` (no enum).
   `MarketIndex {name, kiteSymbol, members, updatedAt|null}`. `UniverseEntry` gains `newListing: boolean`.
   `DataJobType` gains `instrument_sync`; `DataJob` gains `summary: string|null`; `symbols` may be empty only for `instrument_sync`.
3. Anything that used the old 3-value enum keeps compiling (Orbit options move to the API in 089;
   until then keep an exported `DEFAULT_INDEX_NAMES` constant with the 3 names so Orbit builds).

## Acceptance checks
- [ ] Migration up/down test; after upgrade `market_indices` has 19 rows and existing universe rows keep their indices.
- [ ] Constraint tests: sync job with no symbols is accepted; download with no symbols is still rejected.
- [ ] Contract schema tests + parity tests pass; mocks validate.
- [ ] Definition of done in `AGENTS.md` §9.

## Out of scope
- Fetching or syncing anything (086, 087). Screens (088, 089). Downloading index candles.

## Questions

## Handoff
Built by Claude at the Owner's request. All acceptance checks pass.
- Migration 0009: `market_indices` (19 seeded), `universe.new_listing`, `data_jobs.summary` + `instrument_sync`
  type (no symbols), audit `instrument.clear_new`. Downgrade trims universe indices back to the old three.
- `IndexName` is a checked string in Zod and Pydantic; `DEFAULT_INDEX_NAMES` keeps Orbit's and Relay's
  pickers working until 088/089.
- Pulled forward from 087 (the DB CHECK is gone, so the API must guard): universe add/update return 400
  "Unknown index: …" for names not in `market_indices`. `UniverseEntry` views carry `newListing`; jobs carry `summary`.
- Also touched: `nova_contracts/audit.py` + `contracts/src/audit.ts` + Relay `labels.ts` (new action, job type label).
- Checks: `pnpm review:check` green; backend ruff/format + per-package mypy and pytest green (host).
- Guides: DATABASE (0009), API (universe 400), CONTRACTS.

## Review
Self-reviewed. Real stack picks up 0009 on the next `docker compose build` + `up -d` (done with 087).
