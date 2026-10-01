# NOVA-155 — Recorder: store every Kite tick field + compress ticks

**Status:** ready-for-review · **Owner:** Claude · **Branch:** task/NOVA-155 · **Depends on:** —

## Goal
The recorder keeps every field of Kite's `full` packet (D77), not 6: average price, buy/sell quantity, day OHLC,
previous close, last-trade time, OI day high/low and 5-level depth. `ticks` chunks compress after 2 days.

## Read first
- `AGENTS.md`; `docs/DECISIONS.md` row D77
- Kite WebSocket full-mode packet layout (184 bytes; depth from byte 64, 10 × 12-byte entries)

## Files
Create:
- `backend/libs/nova_db/src/nova_db/migrations/versions/rev0025_tick_fields.py`
Modify:
- `backend/services/broker/src/nova_broker/{ticks.py,recorder.py}`, tests `test_ticks.py`, `test_recorder.py`
- `backend/libs/nova_db/src/nova_db/models/data.py`, tests `test_migrations.py`, `test_compression.py`
- `backend/services/atlas/src/nova_atlas/archive.py`, test `test_archive.py`
- `docs/guides/DATABASE.md`

## Build
1. Parser fills every quote/full field; depth = six 5-element lists (bid/ask price, qty, orders), best first.
2. Recorder rows = every `ParsedTick` field (same keys on every row for the bulk insert).
3. Migration 0025: 16 nullable columns; compression (segment `exchange, symbol`, order `received_at`), policy 2 days / 6 h.
4. Parquet archive schema gets the same columns.

## Acceptance checks
- [x] A full packet with distinct values parses into every field; a quote packet has OHLC but no depth.
- [x] LTP and full rows have the same keys = every `ticks` column.
- [x] A compressed tick chunk still reads arrays and deletes one stock; the policy says 2 days.
- [x] Depth and close round-trip through the Parquet archive.
- [x] `docker compose run --rm backend-check` passes (1,320 tests).

## Out of scope
- Showing the new fields in Relay; changing `LiveTick` or the Monitor; candles built from ticks.
- Using Kite's `close` for the live change % (still from `1d` candles).

## Handoff
- Built and deployed before market open on 1 Oct 2026 at the Owner's request (D77: "rush before 09:00, review after
  the close"). Merged to `main` early so the database (0025) and `main` agree; **review still due after 15:45 IST**.
- Kite sends 0 for absent quote/full values (e.g. OI on cash stocks); stored as 0, not null. Timestamps of 0 → null.
- Compression: only chunks older than 2 days; the recorder writes today's chunk only. Archive deletes work on
  compressed chunks (TimescaleDB 2.30, tested).
- Old rows (before today) keep nulls in the 16 new columns.
- Guides: `DATABASE.md` (ticks row).

## Review
_(reviewer — Claude or ChatGPT, ≤ 20 lines — see `docs/templates/REVIEW.md`)_
