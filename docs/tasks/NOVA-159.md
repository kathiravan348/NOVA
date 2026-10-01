# NOVA-159 — Archive: move ticks one stock at a time (bounded memory)

**Status:** planned · **Owner:** — · **Branch:** task/NOVA-159 · **Depends on:** NOVA-155

## Goal
An `archive` job moves a full 3,000-stock day of ticks (D75, D77) to Parquet inside the `atlas-worker` memory
limit (384 MB). Today `_archive_day` loads every row of the day into Python at once, which runs out of memory
at that size (found in the NOVA-155 review).

## Read first
- `AGENTS.md`; `docs/DECISIONS.md` rows D54, D77
- `backend/services/atlas/src/nova_atlas/archive.py` and `tests/test_archive.py`

## Files
Modify:
- `backend/services/atlas/src/nova_atlas/archive.py`, test `backend/services/atlas/tests/test_archive.py`
- `docs/guides/DATABASE.md` (Parquet tick archive row: one line on how files are written)

## Build
1. `_archive_day`: list the day's symbols first (`SELECT DISTINCT symbol` in the window). If any target file
   already exists, raise as today before writing anything.
2. Per symbol: stream its rows ordered by `received_at` with a server-side cursor
   (`execution_options(yield_per=50_000)`), write them with one `pq.ParquetWriter` (row group per batch) to the
   `.parquet.partial` file, then rename it. Memory holds one batch, never the day.
3. Delete and commit the day's rows only after every symbol's file is written (same rule as today: a failure
   leaves the rows in place). Return the same `(paths, rows)` as now.
4. Keep `SCHEMA`, file paths, `archive_ticks`, `archive_days`, `archive_symbols` and `read_ticks` unchanged.

## Acceptance checks
- [ ] Existing archive tests pass unchanged (files, never-overwrite, every Kite field round-trips).
- [ ] With the batch size patched to 2, a symbol with 5 ticks gives one file with 5 rows in time order and
      3 row groups.
- [ ] A write failure on the second symbol leaves every row in `ticks` and no `.parquet` for that symbol.
- [ ] Definition of done in `AGENTS.md` §9 (`docker compose run --rm backend-check` passes).
- [ ] Deploy (D76): rebuild only `atlas-worker` with `--no-deps`; never stop `tick-recorder`, `db` or `redis`.

## Out of scope
- Changing `mem_limit`, the Parquet layout or columns, compression settings, or the Relay archive screens.
- Reading archives (`live_storage.py` already reads in batches).

## Questions
_(implementer writes here if blocked)_

## Handoff
_(implementer, ≤ 20 lines — see `docs/templates/HANDOFF.md`)_

## Review
_(reviewer — Claude or ChatGPT, ≤ 20 lines — see `docs/templates/REVIEW.md`)_
