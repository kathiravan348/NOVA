# NOVA-159 — Archive: move ticks one stock at a time (bounded memory)

**Status:** done · **Owner:** ChatGPT · **Branch:** task/NOVA-159 · **Depends on:** NOVA-155

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
- [x] Existing archive tests pass unchanged (files, never-overwrite, every Kite field round-trips).
- [x] With the batch size patched to 2, a symbol with 5 ticks gives one file with 5 rows in time order and
      3 row groups.
- [x] A write failure on the second symbol leaves every row in `ticks` and no `.parquet` for that symbol.
- [x] Definition of done in `AGENTS.md` §9 (`docker compose run --rm backend-check` passes).
- [x] Deploy (D76): rebuild only `atlas-worker` with `--no-deps`; never stop `tick-recorder`, `db` or `redis`.

## Out of scope
- Changing `mem_limit`, the Parquet layout or columns, compression settings, or the Relay archive screens.
- Reading archives (`live_storage.py` already reads in batches).

## Questions
_(implementer writes here if blocked)_

## Handoff
**Done** (Claude, 1 Oct 2026). `_archive_day` lists the day's symbols (`SELECT DISTINCT`) and checks every
target file before writing. `_write_symbol` streams one symbol ordered by `received_at` (then `exchange`) with
`yield_per=BATCH_ROWS` (50,000) into one `pq.ParquetWriter` on `.parquet.partial`, a row group per batch, then
renames it. A failure removes that symbol's `.partial` and re-raises; rows are deleted and committed only after
every file is written. `SCHEMA`, paths and the public functions are unchanged.
- Changed: `archive.py`, `test_archive.py` (+2 tests: batch size 2 → 5 rows in time order, 3 row groups; a
  failure on the second symbol keeps all 4 rows and leaves no TCS `.parquet`/`.partial`), `DATABASE.md`.
- Checks: `docker compose run --rm --no-deps backend-check` green (ruff, format, mypy, 1335 passed), run from the
  worktree `../NOVA-159` with the main `.env`; `--no-deps`, so `db`/`redis`/recorder were never touched.
- Not done (Owner: keep live and main separate today): no merge, no deploy. After review, after 15:45 IST:
  `docker compose up -d --build --no-deps atlas-worker` (D76).
- Guides: `DATABASE.md` (Parquet tick archive row, State as of). No migration, endpoint or screen.

## Review
**Result:** done (3 Oct 2026).
**Reviewer / built by:** ChatGPT / Claude. **Self-review:** no.
**Fixed directly:** merged current main; kept current schema guide and the archive-writing row.
**Checks:** backend gate green (1405 passed); frontend review:check green (1096 tests, app and Storybook builds).
**Acceptance:** batch size 2 produces 3 time-ordered row groups; second-symbol failure preserves all ticks.
**Guides checked:** DATABASE.md matches the streamed Parquet writes; no schema or endpoint change.
**Deployment:** rebuilt only atlas-worker with --no-deps. Recorder, PostgreSQL and Redis retain their start times.
**Rulebook issues found:** none. **Follow-up tasks created:** none.
