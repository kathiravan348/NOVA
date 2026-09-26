# NOVA-099 — Compress old candles (TimescaleDB compression, migration 0013)

**Status:** done · **Owner:** Claude · **Branch:** task/NOVA-099 · **Depends on:** NOVA-098

## Goal
`candles` chunks older than 30 days are compressed automatically (D58), so 5 years of 1m bars for 1,000
stocks (~465 M rows, ~80 GB plain) fit in roughly 5–8 GB and per-stock reads stay fast. Downloads,
overwrites and **Delete job (+ candles)** keep working on compressed chunks.

## Read first
- `AGENTS.md`; `docs/DECISIONS.md` D58
- `backend/libs/nova_db/src/nova_db/migrations/versions/rev0012_job_delete_notify.py` (migration style)
- `backend/libs/nova_db/tests/test_migrations.py`
- `backend/services/atlas/src/nova_atlas/download.py` (`upsert_candles`), `job_control.py` (`_delete_candles`)

## Files
Create:
- `backend/libs/nova_db/src/nova_db/migrations/versions/rev0013_candle_compression.py`
- `backend/libs/nova_db/tests/test_compression.py`
Modify:
- `backend/libs/nova_db/tests/test_migrations.py` (head revision is `0013`)
- `docs/guides/DATABASE.md` (header → `0001`–`0013`, NOVA-099; `candles` row)

## Build
1. Migration `0013` (TimescaleDB 2.30, the `timescale/timescaledb` image already has compression):
   `ALTER TABLE candles SET (timescaledb.compress, timescaledb.compress_segmentby = 'exchange, symbol, timeframe',
   timescaledb.compress_orderby = 'ts')`, then
   `SELECT add_compression_policy('candles', compress_after => INTERVAL '30 days', schedule_interval => INTERVAL '6 hours')`.
   Downgrade: `remove_compression_policy('candles', if_exists => true)`, `decompress_chunk` on every compressed
   chunk (`show_chunks('candles')`, `if_compressed => true`), then `ALTER TABLE candles SET (timescaledb.compress = false)`.
2. No model change (`python -m nova_db check` must stay clean). No change to service code unless a test in
   step 3 fails; if it does, fix the smallest thing and say so in the handoff.
3. Tests (`test_compression.py`, using the shared `db` fixture): insert 1m bars 60+ days old for two
   symbols, run `compress_chunk` on their chunk, then
   - reading one symbol returns the same rows as before compression;
   - `upsert_candles` with `mode=overwrite` values for a compressed row updates it (ON CONFLICT on compressed chunks);
   - deleting one symbol's rows in the range (same statement as `_delete_candles`) leaves the other symbol intact;
   - the policy exists: `timescaledb_information.jobs` has `proc_name = 'policy_compression'` for `candles`.
4. `DATABASE.md` `candles` row: add "compressed after 30 days (segments: exchange, symbol, timeframe; policy
   every 6 h); writes into old chunks still work and are recompressed by the policy".

## Acceptance checks
- [ ] `docker compose run --rm backend-check` passes, including the new tests.
- [ ] Owner stack: after `migrate`, `SELECT compress_chunk(c, if_not_compressed => true) FROM show_chunks('candles', older_than => INTERVAL '30 days') c;`
      then `hypertable_compression_stats('candles')` shows before/after bytes; note both numbers in the handoff.
- [ ] Market data chart and a backtest over the compressed dates still work on the Owner stack.
- [ ] Definition of done in `AGENTS.md` §9.

## Out of scope
- Compressing `ticks` (old days already move to Parquet and are deleted).
- A storage figure in Relay; retention policies; changing the 30-day chunk size.

## Questions

## Handoff
Done. Migration `0013` + `test_compression.py` (read, overwrite upsert, delete one stock, policy row) and two
migration tests (head `0013`; downgrade to `0012` turns compression off). No service code changed.
- Owner stack (63 stocks, 5.8 M 1m rows): the policy started compressing on `migrate`; after the manual
  `compress_chunk` 11 of 13 chunks are compressed: **706 MB → 42 MB** (`hypertable_compression_stats`);
  the whole table went 825 MB → 161 MB (two newest chunks stay plain).
- Candles endpoint returns 375 1m bars for INFY on 2 Mar 2026 (compressed); a 5-stock SMA backtest
  Feb–Apr 2026 completed (197 trades). Test runs deleted afterwards.
Guides: DATABASE.

## Review
Built and reviewed by Claude. `backend-check` 676 passed. Merged.
