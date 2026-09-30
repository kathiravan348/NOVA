# NOVA-147 — Lists get `total` + `offset`

**Status:** done · **Owner:** Claude · **Branch:** task/NOVA-147 · **Depends on:** NOVA-146

## Goal
Every paged list answers "how many in all" and can start at any row, so screens can show page numbers (D74 (5)).
The D32 cursor keeps working; screens are unchanged in this task (NOVA-148 switches them).

## Read first
- `AGENTS.md`; `docs/DECISIONS.md` rows D32, D74
- `backend/libs/nova_db/src/nova_db/paging.py`, `backend/libs/nova_contracts/src/nova_contracts/page.py`
- `frontend/packages/contracts/src/common.ts`, `frontend/packages/services/src/queries/paging.ts`

## Files
Modify:
- `backend/libs/nova_db/src/nova_db/paging.py` (+ its tests), `backend/libs/nova_contracts/src/nova_contracts/page.py` (+ parity test)
- The list routes that use `newest_first` / `oldest_first`: `backtest/routes.py` (runs, trades), `atlas/jobs.py`, `atlas/unavailable.py`, `core/audit_routes.py`, `core/approval_routes.py`, and their tests
- `backend/services/atlas/src/nova_atlas/coverage.py` (+ test): coverage list gets `total` + `offset`
- `frontend/packages/contracts/src/common.ts` (+ test), generated `schema/*.json` (`schema:update`)
- `frontend/packages/mocks/src/handlers/api.ts` and the handler tests that build a `Page`
- `frontend/packages/services/src/api/*` list functions (`offset` query), `queries/paging.ts`
- `docs/guides/API.md`, `docs/CONTRACTS.md`, `docs/tasks/{BOARD.md,NOVA-147.md}`

## Build
1. `Page` gains `total` (int ≥ 0, count of all rows matching the filters). `PageQuery` gains `offset` (int ≥ 0).
2. Paging helpers: `offset` given → `OFFSET`/`LIMIT` on the same order; else keyset cursor as today. Both together → 422.
   `total` = one `COUNT(*)` over the same `where`. `next_cursor` stays filled in both modes.
3. Every endpoint above accepts `offset` and returns `total`; limit rules unchanged (default 50, max 200).
4. Mock handlers: same `offset`, `total` from the filtered mock list. Services: `offset` reaches the URL.
5. Existing Load more screens keep working (they ignore `total`).

## Acceptance checks
- [x] `?offset=50&limit=50` returns rows 51–100 and the right `total` on each list; cursor paging still passes its tests.
- [x] Zod schema and Pydantic model agree (parity tests); mocks validate.
- [x] Definition of done in `AGENTS.md` §9 (`pnpm review:check` and `backend-check`).

## Out of scope
- Screen changes (NOVA-148); new sort orders; removing cursors.

## Questions
_(implementer writes here if blocked)_

## Handoff
**Done:** Added filtered totals and offset paging; retained cursor paging and existing screens.
**Files changed:** backend paging/contracts/list routes/tests; frontend contracts/schema/mocks/services/tests; API.md; CONTRACTS.md.
**Commands run:** pnpm review:check passed (1,014 tests + builds); docker compose run --rm backend-check passed (1,276 tests).
**Checked:** UI unchanged; viewport/theme checks not applicable.
**New dependencies:** none.
**Maps updated:** CONTRACTS.
**Guides updated:** API.
**Deviations from task:** Updated existing realtime/approval Page fixtures for the required total; coverage client collects pages for existing local grouping.
**Known gaps:** Independent lead review and merge pending._

## Review
**Result:** done
**Reviewer / built by:** Claude / ChatGPT. **Self-review:** no.
**Fixed directly (review: commits):** none.
**Change requests (if sent back):** none.
**Checked:** offset and cursor paths share one ordering; both together → 422; `total` counted over the same `where`. `pnpm review:check` passed; `backend-check` 1,275 passed, 1 failed (`test_realtime.py::test_signed_in_gets_hello_then_job_updates`, timing under load — ran alongside the frontend build); the file passes alone twice (5/5).
**Watch:** `/market-data/coverage` now returns at most 50 rows by default (max 200); `getCoverage` fetches every page when no paging is asked for, so the ~2,500-stock table costs ~13 requests. A follow-up could raise the coverage limit if this feels slow.
**Guides checked:** API.md and CONTRACTS.md match the diff.
**Rulebook issues found:** none.
**Follow-up tasks created:** none.
