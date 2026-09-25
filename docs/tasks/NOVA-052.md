# NOVA-052 — Atlas/Broker: live tick recorder + Parquet archive

**Status:** done · **Owner:** Claude · **Branch:** task/NOVA-052 · **Depends on:** NOVA-051

## Goal
From go-live, ticks for chosen symbols are recorded from Kite's WebSocket into a `ticks` hypertable (D11), and old
ticks move to Parquet files partitioned by date and symbol (D49). Kite traffic stays in the broker (D35).

## Read first
- `AGENTS.md` (§8, §10), `docs/DECISIONS.md` (D11, D35, D40, D41, D49), `docs/ARCHITECTURE.md` (Data)
- `backend/services/broker/src/nova_broker/{internal.py,cli.py}`, `backend/services/atlas/src/nova_atlas/cli.py`

## Files
DB: `nova_db/models/data.py` (`Tick`), `migrations/versions/rev0004_ticks.py`, `tests/test_migrations.py`
Broker: `nova_broker/{ticks.py,recorder.py,cli.py}`, `tests/{test_ticks.py,test_recorder.py}`
Atlas: `nova_atlas/{archive.py,cli.py}`, `tests/test_archive.py`
Also: `backend/pyproject.toml`, `uv.lock`, `compose.yaml` (`tick-recorder` profile `market`, archive volume),
`docs/{DECISIONS,ARCHITECTURE,STRUCTURE}.md`, `backend/README.md`

## Build
1. `ticks (exchange, symbol, received_at, exchange_ts, last_price_paise, last_qty, volume, oi)`, PK incl. `received_at`,
   hypertable (1-day chunks). Migration 0004.
2. `parse_ticks(message)`: Kite binary frames (2-byte count, 2-byte length + packet); `ltp` (8 B), `quote` (44 B)
   and `full` (184 B, exchange timestamp) packets; 1-byte heartbeats ignored; unknown lengths skipped.
3. Recorder: tokens from `instruments`, first live session (as `/internal/kite/*`), `wss://ws.kite.trade` with the key
   and token, subscribe + `full` mode, insert in batches (≤ 1 s or 500 ticks), reconnect with backoff (1→30 s),
   stop at 15:30 IST or SIGTERM. The WebSocket connector is injectable (tests use a fake).
4. Archive: rows before a date → `archive/date=YYYY-MM-DD/symbol=SYM/ticks.parquet` (pyarrow), then delete them in the
   same transaction after the files are written. Never overwrites an existing file.

## Acceptance checks
- [x] Tests: packet parsing (all modes, heartbeat, garbage), recorder with a fake socket (batches, reconnect, stop),
      archive round-trip + delete + no-overwrite. `backend-check` passes.

## Out of scope
- Order updates on the socket (Phase 3), options/futures symbols, a screen to start recording, bar building from ticks.

## Handoff
**Done:** Built by Claude on Owner request (2026-09-25). `ticks` hypertable (rev 0004), Kite binary parser,
`Recorder` (injectable socket/clock/sleep), `record-ticks` (`--symbols`, default all NSE with a token, max 3000),
`archive-ticks --before` (one IST day per transaction; `.partial` file then rename), Compose `tick-recorder`
(profile `market`) and `tick-archive` volume on `atlas-worker`.
**Commands run:** `backend-check` pass (344). Migration applied; `nova_db check` exit 0; `record-ticks` without
Kite keys exits 1 with a clear message; `archive-ticks` on an empty table writes nothing.
**New dependencies:** `websockets==17.1` (broker), `pyarrow==25.0.1` (Atlas; mypy override, no stubs).
**Deviations:** receive times are made unique per symbol (+1 µs) because they are in the primary key; inserts use
`ON CONFLICT DO NOTHING`. **Known gaps:** not run against live Kite (no keys on this machine).

## Review
**Result:** done
**Fixed directly:** line-length and mypy issues in the tests; the archive command runs in `atlas-worker` (it
has the volume), so the README says so.
**Rulebook issues found:** none. **Follow-up tasks created:** none (first live-market run is an Owner check).
