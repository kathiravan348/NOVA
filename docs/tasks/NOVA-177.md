# NOVA-177 — Timeline events endpoint + held time on sells (D83)

**Status:** done · **Owner:** Claude · **Branch:** task/NOVA-177 · **Depends on:** NOVA-175

## Goal
`GET /backtests/{id}/timeline` returns a run's buys and sells as one flat list, oldest first, and paged.
Each sell carries `entryAt`, the time its buy happened, so screens can show how long it was held.

## Read first
- `AGENTS.md` §7, §8; `docs/DECISIONS.md` row D83
- `backend/services/backtest/src/nova_backtest/ledger.py`, `routes.py` (the `/ledger` routes)
- `frontend/packages/mocks/src/handlers/ledger.ts`, `frontend/packages/services/src/api/orbit.ts`

## Files
Modify:
- `backend/libs/nova_contracts/src/nova_contracts/backtest.py` (`LedgerEvent.entry_at`), `backend/libs/nova_contracts/tests/test_backtest.py`
- `backend/services/backtest/src/nova_backtest/ledger.py`, `routes.py`
- `backend/services/backtest/tests/test_ledger.py`, `test_api.py`
- `frontend/packages/contracts/src/backtest.ts`, `backtest.test.ts`, `jsonSchema.test.ts`, `schema/LedgerEvent.json` + new `schema/LedgerEventPage.json` (run `schema:update`)
- `frontend/packages/mocks/data/ledgers.json` (add `entryAt` to every sell), `src/handlers/ledger.ts`, `src/handlers/orbit.test.ts`
- `frontend/packages/services/src/api/orbit.ts`, `src/queries/orbit.ts`, `src/queries/queries.test.tsx`
- `docs/CONTRACTS.md`, `docs/guides/API.md`

## Build
1. Contract: `LedgerEvent` gets `entryAt` (UTC date-time, nullable): the trade's `entry_at` on sells, `null` on buys.
   Zod and Pydantic stay in parity. The existing `/ledger/{date}` response includes it too.
2. `ledger.py`: set `entry_at` on sell events; add `timeline(ledger, from_, to, symbol) -> list[LedgerEvent]`:
   all events in their existing order (same sort as today), kept when the IST date is inside `from`..`to`
   (inclusive) and the symbol matches. Cash after stays the portfolio's, as in `/ledger/{date}`.
3. Route `GET /backtests/{run_id}/timeline`, params `offset`, `limit` (default and max as `/ledger`), `from`, `to`,
   `symbol`. Returns `Page[LedgerEvent]` with `next_cursor=None` and `total`. Same errors as `/ledger` (404, both 400s,
   reversed dates). Parity check against `LedgerEventPage`.
4. Mocks: every sell in `ledgers.json` gets the `at` of its buy (same symbol, earlier) as `entryAt`; buys get `null`.
   Handler for `/backtests/:id/timeline` with the same filters, errors and paging as the backend.
5. Services: `listBacktestTimeline(id, { symbol, from, to, offset, limit })` and
   `useBacktestTimeline(id, filter, pageSize = 50)` with `useInfiniteQuery` (next offset = items loaded while
   `< total`). It returns the flat `items`, `total`, `hasNextPage`, `fetchNextPage`, `isFetchingNextPage`, and the
   usual pending/error/refetch fields. Query key under `queryKeys.backtests.detail(id)`.
6. `API.md`: add the row, add `entryAt` to the `/ledger/{date}` row; update "State as of".

## Acceptance checks
- [ ] Backend test: a sell's `entryAt` equals its trade's `entry_at`; buys have `null`.
- [ ] Backend API test: timeline is oldest first, `total` right, paging, symbol and date filters, all four errors.
- [ ] Mock handler test mirrors these; `ledgers.json` passes the schema test.
- [ ] Hook test: two pages load in order and `hasNextPage` turns false at the end.
- [ ] `pnpm review:check` and `docker compose run --rm backend-check` pass.

## Out of scope
- Any screen change (NOVA-178). Removing `/ledger` or `/ledger/{date}`. Migrations (none needed).
- Deploy: backtest service only, `docker compose up -d --build --no-deps backtest` (allowed in market hours, D76).

## Questions
_(implementer writes here if blocked)_

## Handoff

**Done:** `GET /backtests/{id}/timeline` (offset pages, IST date/symbol filters), `entryAt` on sell events, mock handler, `useBacktestTimeline`.
**Files changed:** listed files; `schema/LedgerEventPage.json` is new (generated).
**Commands run:** backend-check (1417 passed); review:check: format, lint, typecheck green; tests 1146/1147 (relay `approvalBatch` timed out while Docker ran in parallel), re-run with 4 workers 1147/1147; builds green.
**Checked:** no screen changes (n/a).
**New dependencies:** none. **Maps updated:** CONTRACTS. **Guides updated:** API.
**Deviations from task:** none. `ledger.py` shares the reversed-date check between `/ledger` and `/timeline`.
**Known gaps:** none. Mocks filter by the UTC date prefix, like `/ledger/{date}` (all mock times are IST daytime).

## Review
**Result:** done (3 Oct 2026).
**Reviewer / built by:** Claude / Claude. **Self-review:** yes (Owner asked Claude to build and review).
**Fixed directly (review: commits):** none needed.
**Checks:** backend-check 1417 passed; frontend format, lint, typecheck, 1147 tests (4 workers), app + Storybook builds green.
**Acceptance:** `entryAt` on sells / null on buys (unit + API + mock tests); timeline order, `total`, paging,
symbol and IST date filters, 404 and both 400s plus reversed dates (API and mock); hook loads two pages then stops.
The gateway routes `/backtests/*` by prefix, so the new path needs no gateway change.
**Guides checked:** API.md rows (`/timeline`, `entryAt`) and CONTRACTS.md match the diff.
**Rulebook issues found:** none. **Follow-up tasks created:** none.
