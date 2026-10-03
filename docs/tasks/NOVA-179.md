# NOVA-179 — Recorder: record chosen indices into `index_ticks` (D84, migration 0030)

**Status:** done · **Owner:** Claude · **Branch:** task/NOVA-179 · **Depends on:** —

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
**Answer (Claude, planner, 3 Oct):** yes — test fixtures that return `RecorderSettings` get `indices: []`; done in the takeover.

## Handoff
**Done:** ChatGPT built the task (`f791f04`) and stopped on the question above; Claude took over (ChatGPT down, Owner request 3 Oct).
**Files changed (takeover):** Relay fixtures `overview.test.tsx`, `live/config.test.tsx`, `live/live.test.tsx` (`indices: []`);
`rev0030_index_ticks.py` (hypertable without default indexes, like `ticks`); `broker/tests/conftest.py` (resets
`indices`, `index_ticks` and index tokens between tests); `ticks.py` (non-positive index day prices → null) + test.
**Commands run:** backend-check 1416 passed / 12 failed before the fixes (model diff from the default hypertable
index; settings tests leaking `NIFTY 50`; one limiter timing flake); after: nova_db + broker 266 passed in Docker,
ruff, format, mypy clean. review:check: format, lint, typecheck, build green; tests 137/138 files, the failing
`approvalBatch.test.tsx` (timeout under Docker load, as in NOVA-177) passes alone.
**Checked:** no screens. **New dependencies:** none. **Maps updated:** CONTRACTS. **Guides updated:** API, DATABASE.
**Deviations from task:** `conftest.py` and three Relay test files outside Files (test state only).
**Known gaps:** index ticks are not archived to Parquet (out of scope).

## Review
**Result:** done (3 Oct 2026).
**Reviewer / built by:** Claude / ChatGPT + Claude (takeover). **Self-review:** yes (Owner asked Claude to finish and self-review while ChatGPT is down).
**Fixed directly:** the takeover fixes above.
**Acceptance:** 28/32-byte index packets parsed (zero LTP skipped); index rows go to `index_ticks`, stock rows to
`ticks`; index-only ticks do not feed the stall watchdog, Redis or stock counts; `indices` kept when absent/null,
unknown or tokenless index 400, 2,990 + 11 → 400; migration round trip, hypertable + compression.
**Guides checked:** API.md recorder rows, DATABASE.md `index_ticks` + `recorder_settings.indices`, CONTRACTS.md match the diff.
**Deploy:** Saturday night (D76 allows): migrate 0030, then `broker tick-recorder` with `--no-deps`.
**Rulebook issues found:** none. **Follow-up tasks created:** none.
