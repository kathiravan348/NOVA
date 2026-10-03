# NOVA-179 — Recorder: record chosen indices into `index_ticks` (D84, migration 0030)

**Status:** in-progress · **Owner:** ChatGPT · **Branch:** task/NOVA-179 · **Depends on:** —

## Goal
The recorder also streams the indices the Owner chooses and saves their ticks in a new `index_ticks` table,
so intraday research has its market gate on recorded days.

## Read first
- `AGENTS.md` §1 (D76), §7a, §8; `docs/DECISIONS.md` D77, D79, D81, D84; the broker files below
- `backend/libs/nova_db/src/nova_db/migrations/versions/rev0025_tick_fields.py` (compression pattern)

## Files
Create:
- `backend/libs/nova_db/src/nova_db/migrations/versions/rev0030_index_ticks.py`
Modify:
- `backend/libs/nova_db/src/nova_db/models/data.py` (`IndexTick`), `models/broker.py`, `models/__init__.py`, `tests/test_migrations.py`
- `backend/libs/nova_contracts/src/nova_contracts/recorder.py`, `backend/libs/nova_contracts/tests/test_recorder.py`
- `backend/services/broker/src/nova_broker/ticks.py`, `recorder.py`, `recorder_loop.py`, `recorder_settings.py`
- `backend/services/broker/tests/test_ticks.py`, `test_recorder.py`, `test_recorder_loop.py`, `test_recorder_settings.py`
- `frontend/packages/contracts/src/recorder.ts`, `recorder.test.ts`, `schema/RecorderSettings.json`, `schema/RecorderSettingsUpdate.json` (run `schema:update`)
- `frontend/packages/mocks/src/handlers/relay.ts` (recorder GET/PUT keep `indices`), `src/handlers/relay.test.ts`
- `docs/CONTRACTS.md`, `docs/guides/API.md`, `docs/guides/DATABASE.md`

## Build
1. Migration 0030: `recorder_settings.indices text[] NOT NULL DEFAULT '{}'` (existing row keeps recording exactly as
   today). Table `index_ticks`: `symbol` (index name, FK `market_indices.name`), `received_at` (PK with symbol),
   `exchange_ts` (nullable), `last_price_paise`, `high_paise`, `low_paise`, `open_paise`, `close_paise` (Kite's
   previous close), all bigint > 0 where present. Hypertable on `received_at`; compress after 2 days, segment by
   `symbol`, like `ticks` (rev 0025).
2. Contracts: `RecorderSettingsUpdate.indices: list[IndexName] | None` (max 50; absent/None = keep the saved list);
   `RecorderSettings.indices: list[IndexName]` always present. Zod and Pydantic in parity.
3. `recorder_settings.py` PUT: unknown index or one without a Kite token → 400 naming it; stocks + indices > 3,000 →
   400 `Kite streams at most 3000 instruments: <n> stocks + <m> indices`. Audit as today (`indices` in the details).
4. `recorder_loop.py`: subscribe stock tokens **and** the chosen indices' tokens; the 3,000 check counts both.
5. `ticks.py`: parse index packets (28 bytes: token, LTP, high, low, open, close, change; 32 bytes adds the
   exchange time) into an `IndexTick`; equity parsing unchanged.
6. `recorder.py`: index ticks go to their own buffer and are saved to `index_ticks` on the same batch cycle and
   with the same keep-on-failure rule (D79). They do **not** reset the stall watchdog (`_last_tick` stays
   stock-only, D81), are not published to Redis and are not counted in stock summaries.
7. Mocks: the recorder handler stores and returns `indices` (default `[]`). Guides: `DATABASE.md`, `API.md`.

## Acceptance checks
- [ ] Parser test: 28- and 32-byte index packets → right prices and time; equity packets unchanged.
- [ ] Recorder test: mixed message → rows in the right sinks; 10 s of index ticks only still trigger the reconnect.
- [ ] Settings tests: indices saved and returned; absent `indices` keeps them; unknown index 400; 2,990 + 11 → 400.
- [ ] Migration test: upgrade/downgrade; `index_ticks` is a hypertable with compression. Backend-check and review:check pass.

## Out of scope
- The Relay screen (NOVA-180); using index ticks in backtests (NOVA-187); archiving `index_ticks` to Parquet.
- Deploy after 15:45 IST or at a weekend only (D76): `docker compose run --rm --no-deps migrate`, then
  `docker compose up -d --build --no-deps broker tick-recorder`. Indices are recorded once the Owner adds them (180).

## Questions
Full review:check exposed recorder-response fixtures without the new required `indices` field in Relay overview/live tests (outside Files). Owner asked whether these directly affected fixtures may be updated; backend validation continues while awaiting scope confirmation.

## Handoff
_(implementer, ≤ 20 lines — see `docs/templates/HANDOFF.md`)_

## Review
_(reviewer — Claude or ChatGPT, ≤ 20 lines — see `docs/templates/REVIEW.md`)_
