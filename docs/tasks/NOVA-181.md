# NOVA-181 — Atlas: tick size per instrument + longest feed gap per session (D84, migration 0031)

**Status:** in-progress · **Owner:** ChatGPT · **Branch:** task/NOVA-181 · **Depends on:** NOVA-179 (shares `models/data.py`, migration after 0030)

## Goal
Every synced stock stores its price step (`tick_size_paise`) from Kite, and every summarized recording day stores
its longest recorder-wide gap in seconds, so the intraday simulator can add slippage in ticks and reject days
with a gap over 30 s (`docs/INTRADAY-RESEARCH.md` §2, §7).

## Read first
- `AGENTS.md` §1 (D76), §7a, §8; `docs/DECISIONS.md` D56, D80, D84
- `backend/services/atlas/src/nova_atlas/universe.py` (`kite_stocks`, `sync_instruments`), `live_summary.py`

## Files
Create:
- `backend/libs/nova_db/src/nova_db/migrations/versions/rev0031_tick_size_feed_gap.py`
Modify:
- `backend/libs/nova_db/src/nova_db/models/data.py` (`Instrument`, `TickSession`), `backend/libs/nova_db/tests/test_migrations.py`
- `backend/services/atlas/src/nova_atlas/universe.py`, `live_summary.py`
- `backend/services/atlas/tests/test_universe.py`, `test_live_summary.py`
- `backend/libs/nova_testing/src/nova_testing/kite.py` (only if its instrument rows lack realistic `tick_size` values)
- `docs/guides/DATABASE.md`

## Build
1. Migration 0031: `instruments.tick_size_paise integer NULL CHECK (tick_size_paise > 0)`;
   `tick_sessions.longest_feed_gap_seconds integer NULL CHECK (BETWEEN 0 AND 22500)`. Both nullable: old rows
   stay valid until the next sync / summary fills them.
2. `kite_stocks`: read Kite's `tick_size` (rupees, e.g. `0.05`) as exact paise with `Decimal` (`0.05` → 5,
   `0.01` → 1); a missing or zero value → `None`. `sync_instruments` writes it on every synced instrument.
   It is today's step only (no history); the guide calls for the date's step — note this in `DATABASE.md`.
3. `live_summary.py`: while building `active` seconds, also compute the longest run of consecutive session
   seconds (09:15:00–15:29:59 IST) in which **no stock** had a tick, including a run at the start or end of the
   session; a day with no rows → 0, like `feed_gap_seconds`. Save it in `longest_feed_gap_seconds`.
4. `summarize_next` also re-summarizes stored days whose `longest_feed_gap_seconds` is null (oldest first, one
   per call as today), so 1 Oct and later days get the value without a manual step.
5. `DATABASE.md`: both columns, migration 0031 in the header, "State as of".

## Acceptance checks
- [ ] Universe test: `0.05` → 5, `0.01` → 1, blank → null; values saved on sync.
- [ ] Summary tests: ticks with gaps of 12 s and 45 s → `longest_feed_gap_seconds = 45`; a gap from 09:15:00 to the
      first tick counts; a day already summarized with a null value is summarized again; others are not.
- [ ] Migration test: upgrade/downgrade; constraints reject 0 and negative values.
- [ ] `docker compose run --rm backend-check` passes.

## Out of scope
- Any contract, endpoint or screen change (the values are read by the intraday simulator, NOVA-185, and shown later).
- Historical tick sizes. Changing `feed_gap_seconds` or the D82 usable-day rule for candle-simulator runs.
- Deploy after 15:45 IST or at a weekend only (D76): `docker compose run --rm --no-deps migrate`, then
  `docker compose up -d --build --no-deps atlas atlas-worker`; then press **Sync with Kite** once in Relay → Instruments.

## Questions
_(implementer writes here if blocked)_

## Handoff
_(implementer, ≤ 20 lines — see `docs/templates/HANDOFF.md`)_

## Review
_(reviewer — Claude or ChatGPT, ≤ 20 lines — see `docs/templates/REVIEW.md`)_
