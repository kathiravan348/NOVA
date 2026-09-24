# NOVA-047 — Database schema v1 + Alembic migrations

**Status:** done · **Owner:** Claude · **Branch:** task/NOVA-047 · **Depends on:** NOVA-043

## Goal
`docker compose up -d` migrates PostgreSQL to schema v1: every table behind the frozen contracts (users/roles,
strategies + versions, backtest runs/results/trades, broker accounts/sessions/profiles, rate-limit rules, data jobs,
audit, instruments) and `candles` as a TimescaleDB hypertable. Models and migration are proven identical (D37).

## Read first
- `AGENTS.md` (§5, §5a, §8), `docs/DECISIONS.md` (D12, D17, D27, D32, D33, D37), `docs/ARCHITECTURE.md` (Data)
- `frontend/packages/contracts/src/*.ts` (field names, enums, refinements = CHECK constraints)

## Files
Create: `backend/libs/nova_db/{pyproject.toml,src/nova_db/{__init__.py,__main__.py,py.typed,engine.py,ids.py,enums.py}}`,
`backend/libs/nova_db/src/nova_db/models/{__init__.py,base.py,auth.py,strategy.py,backtest.py,broker.py,data.py}`,
`backend/libs/nova_db/src/nova_db/{migrate.py,migrations/{env.py,script.py.mako,versions/rev0001_schema_v1.py}}`,
`backend/libs/nova_db/tests/{conftest.py,test_migrations.py,test_constraints.py,test_ids.py}`
Modify: `backend/pyproject.toml`, `backend/uv.lock`, `compose.yaml` (`migrate` service; `backend-check` gets the db),
`docs/DECISIONS.md` (D37), `docs/ARCHITECTURE.md` (Data), `docs/STRUCTURE.md`, `docs/PLAN.md`, `docs/tasks/BOARD.md`

## Build
1. Deps (pinned): sqlalchemy, alembic, psycopg[binary]. Sync engine from `NOVA_DATABASE_URL`.
2. Models (SQLAlchemy 2 typed `Mapped[...]`, snake_case columns): text ids `<prefix>_<sortable hex>` (`ids.new_id`),
   `timestamptz` everywhere, money `bigint` paise, percents `numeric(12,4)`, enums as text + CHECK (values in `enums.py`,
   copied from the Zod enums). Contract refinements become CHECKs (net = gross − charges, charges total = sum, exit
   pair, from ≤ to, error only when failed, nova ≤ broker limit, target pair). List indexes: `(created_at, id)` /
   `(at, id)` for cursor pages (D32), `backtest_runs (strategy_id, created_at, id)`, `trades (run_id, entry_at, id)`.
3. `candles (exchange, symbol, timeframe, ts, open/high/low/close paise, volume)`, PK incl. `ts`, hypertable on `ts`
   (30-day chunks). Daily bars are stored at 00:00 IST. Instruments hold master data only; computed fields
   (last close, 52w, volume, coverage) come from candles in NOVA-051.
4. Migration `0001` hand-written, seeds role `super_admin`, enables `timescaledb`. `python -m nova_db upgrade|downgrade|check`.
5. Compose: `migrate` (runs `upgrade head`, `core` waits for it); `backend-check` depends on healthy `db` and gets
   `NOVA_TEST_DATABASE_URL`. DB tests create and drop a throwaway database; they skip when the variable is unset (host).
6. Tests: upgrade → expected tables + hypertable; model metadata vs migrated DB has no diff; downgrade → empty; each
   CHECK rejects a bad row; `new_id` is prefixed and sortable.

## Acceptance checks
- [x] `docker compose up -d` → `migrate` exits 0, core healthy. `docker compose run --rm backend-check` passes (DB tests run).
- [x] mypy strict with no new ignores except where commented. Definition of done in `AGENTS.md` §9.

## Out of scope
- Repositories/queries (service tasks), auth sessions (048), ticks (052), fee-rate tables (053), seed data beyond roles.

## Questions
_(implementer writes here if blocked)_

## Handoff
**Done:** Built by Claude on Owner request (2026-09-24). Schema v1 (16 tables), hypertable, `migrate` service, DB tests.
**Commands run:** `docker compose run --rm backend-check` pass (62 tests, DB tests included); `docker compose up -d` →
migrate exit 0, core healthy; `python -m nova_db check` exit 0.
**New dependencies:** sqlalchemy 2.0.54, alembic 1.20.0, psycopg[binary] 3.3.6.
**Deviations:** migration drafted with Alembic autogenerate, then edited by hand (extension, hypertable, role seed);
file is `rev0001_schema_v1.py` (module names cannot start with a digit). Ruff E501 ignored in migration files only.
**Known gaps:** none.

## Review
**Result:** done
**Fixed directly:** `trades.exit_pair` CHECK passed when `exit_price_paise` was NULL (NULL > 0 is unknown); now
requires `IS NOT NULL` explicitly. Caught by `test_bad_row_is_rejected[trade exit pair]`.
**Rulebook issues found:** none. **Follow-up tasks created:** none.
