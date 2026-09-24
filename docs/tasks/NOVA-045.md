# NOVA-045 — Pagination envelope: contracts, mock handlers, services

**Status:** done · **Owner:** Claude · **Branch:** task/NOVA-045 · **Depends on:** NOVA-022

## Goal
The four growing lists return `{ items, nextCursor }` pages with `limit`/`cursor` (D32), mocks serve real
pages, and the services hooks load pages while still giving screens a flat array. Screens do not change.

## Read first
- `AGENTS.md` (§7), `docs/DECISIONS.md` (D21, D22, D32)
- The files listed below

## Files
Modify: contracts `src/{common.ts,common.test.ts}`; mocks `src/handlers/{api.ts,orbit.ts,orbit.test.ts,relay.ts,relay.test.ts,scenarios.ts,scenarios.test.ts}`;
services `src/api/{orbit.ts,relay.ts,api.test.ts}`, `src/queries/{orbit.ts,relay.ts,keys.ts,paging.ts,queries.test.tsx}`, `src/http.ts`, `src/index.ts`;
`docs/CONTRACTS.md`

## Build
1. Contracts: `pageSchema(item)` → `z.strictObject({ items: z.array(item), nextCursor: z.string().min(1).nullable() })`,
   type `Page<T>`; `PageQuery = { limit?: number (int 1–200); cursor?: string }`, `PAGE_LIMIT_DEFAULT = 50`.
2. Mocks `api.ts`: `paginate(items, url)` reads `limit` and `cursor` from the request URL; the cursor is an
   opaque string (base64 of the offset is fine); bad `limit` or unknown cursor → 400 `invalid_request`.
   Apply it to `GET /backtests` (also filter `?strategyId=`), `/backtests/:id/trades`, `/data-jobs`, `/audit`.
   Order unchanged from the mock files. Empty scenario returns `{ items: [], nextCursor: null }` for these four;
   all other endpoints keep bare arrays.
3. Services: `listBacktests({ strategyId?, limit?, cursor? })`, `listBacktestTrades(id, query)`,
   `listDataJobs(query)`, `listAuditEntries(query)` (the `init` argument stays last) validate with `pageSchema`. Hooks `useBacktests(filter?)`,
   `useBacktestTrades`, `useDataJobs`, `useAuditEntries` use `useInfiniteQuery` with
   `select: (d) => d.pages.flatMap((p) => p.items)`, so `data` stays `T[]` and `hasNextPage` /
   `fetchNextPage` / `isFetchingNextPage` are available. Query keys include the filter.
4. Tests: handler pages (limit 1 walks every item exactly once, last page `nextCursor: null`, strategyId
   filter, 400 cases); service validation rejects a bare array; a hook test fetches two pages and returns
   the flat array.
5. `CONTRACTS.md`: mark the four endpoints as `Page<…>` with the query parameters.

## Acceptance checks
- [x] Mocks, services and contracts tests pass; `git diff main --stat` shows no file under `frontend/apps/`.
- [x] Orbit and Relay app tests pass unchanged; both apps render the same lists as before (default limit 50
      covers every mock row).
- [x] Definition of done in `AGENTS.md` §9.

## Out of scope
- "Load more" buttons and the strategy detail switching to `strategyId` (NOVA-046).
- Pagination for any other endpoint; mock JSON data changes; backend code.

## Questions
_(implementer writes here if blocked)_

## Handoff
**Done:** Built by Claude on Owner request (2026-09-24). Four lists return `Page<T>`; hooks are infinite queries with flat `data`.
**Files changed:** as listed, plus `services/src/queries/paging.ts` (shared `pagedListOptions`, `flattenPages`,
`cursorQuery`) and `services/src/http.ts` (`withQuery`). No file under `frontend/apps/` changed.
**Commands run:** `pnpm review:check` pass (90 test files); Relay data-jobs page checked in the browser (5 jobs, mock mode).
**New dependencies:** none. **Maps updated:** CONTRACTS.
**Deviations:** a cursor pointing at or past the end is rejected as unknown (never issued by the server).

## Review
**Result:** done
**Fixed directly:** paging helpers moved to their own module (orbit and relay hooks share them); `it.each` titles use strings only.
**Rulebook issues found:** none. **Follow-up tasks created:** none (046 adds "Load more" and the `strategyId` filter in screens).
