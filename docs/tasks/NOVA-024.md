# NOVA-024 — MSW: handlers for every contract endpoint + ApiError contract

**Status:** done · **Owner:** Claude · **Branch:** task/NOVA-024 · **Depends on:** NOVA-005

## Goal
`@nova/mocks` exports MSW request handlers that serve the static mocks for every endpoint in `docs/CONTRACTS.md`, plus scenario handlers (empty, error) for stories and tests (D21). Services (NOVA-006) and apps will start MSW; this task does not.

## Read first
- `AGENTS.md` (§7), `docs/DECISIONS.md` (D17, D21), `docs/CONTRACTS.md`
- `frontend/packages/mocks/{package.json,tsconfig.json,vitest.config.ts,src/index.ts,src/data.ts}`
- `frontend/packages/contracts/src/{index.ts,common.ts,backtest.ts}` (pattern for a new contract + test)

## Files
Create:
- `frontend/packages/contracts/src/error.ts` + `error.test.ts`
- `frontend/packages/mocks/src/handlers/{api.ts,orbit.ts,relay.ts,scenarios.ts,index.ts}`
- `frontend/packages/mocks/src/handlers/{orbit.test.ts,relay.test.ts,scenarios.test.ts}`
Modify: `frontend/packages/contracts/src/index.ts`, `frontend/packages/mocks/{package.json,src/index.ts}`, `frontend/pnpm-lock.yaml` (via `pnpm install`), `docs/CONTRACTS.md`, `docs/STRUCTURE.md`

## Build
1. Contract `error.ts`: `ApiErrorCodeSchema = z.enum(["not_found", "internal"])`; `ApiErrorSchema = z.strictObject({ error: z.strictObject({ code: ApiErrorCodeSchema, message: z.string().min(1) }) })`; export types. Test: valid body passes, unknown code and extra keys fail. Export from `index.ts`.
2. `mocks/package.json`: dependency `msw` 2.x (exact latest stable). No other dependency.
3. `handlers/api.ts`: `export const API_BASE_PATH = "/api/v1";` a helper `apiPath(path)` returning `*/api/v1${path}` (any origin, works in browser and Node), and `notFound(message)` returning `HttpResponse.json<ApiError>(…, { status: 404 })`.
4. `handlers/orbit.ts` (`orbitHandlers`) and `handlers/relay.ts` (`relayHandlers`), all `http.get`, bodies taken from `../data` exports, bare JSON (lists are plain arrays, D21):
   - `/me` → `mockUser`. `/strategies`, `/strategies/:id`. `/backtests`, `/backtests/:id`, `/backtests/:id/result` (404 if the run is unknown or has no result), `/backtests/:id/trades` (trades whose `runId` matches; 404 if run unknown; `[]` if it has none).
   - `/broker/accounts`, `/broker/accounts/:id`, `/broker/rate-limits`, `/data-jobs`, `/data-jobs/:id`, `/audit`.
   - Unknown ids → `notFound("<Thing> <id> not found")`. Selecting by id/runId is allowed; no other computation (AGENTS §7).
5. `handlers/scenarios.ts`: `emptyHandlers` (every list endpoint returns `[]`) and `errorHandlers` (every endpoint above returns 500 with code `internal`). Same paths, so `server.use(...errorHandlers)` overrides.
6. `handlers/index.ts`: `handlers = [...orbitHandlers, ...relayHandlers]`; re-export the rest. `src/index.ts` re-exports `./handlers`. Never import `msw/node` or `msw/browser` outside tests.
7. Tests use `setupServer` from `msw/node` (listen in `beforeAll`, `resetHandlers` in `afterEach`, `close` in `afterAll`) and `fetch("http://localhost/api/v1/...")`. One `it` per endpoint: status 200 and body parses with its contract schema (`XSchema.array()` for lists) and equals the mock. Plus: each 404 case parses with `ApiErrorSchema`; trades for a completed run all have that `runId`; empty and error scenarios per endpoint.
8. `CONTRACTS.md`: add an `ApiError` row (any endpoint, 404/500, no mock file) and a note under the title: handlers live in `mocks/src/handlers/`. `STRUCTURE.md`: add `src/handlers/` under `mocks/`.

## Acceptance checks
- [x] `pnpm --filter @nova/mocks test` and `pnpm --filter @nova/contracts test` pass; root `pnpm test` runs both.
- [x] Every endpoint in `CONTRACTS.md` has a handler and a test. No existing mock JSON or contract changes.
- [x] `pnpm build` passes (no Node-only import in the browser path). Files ≤ 300 lines, no `any`.
- [x] Definition of done in `AGENTS.md` §9 (stories n/a).

## Out of scope
- `msw init` / `mockServiceWorker.js`, starting the worker in apps or Storybook, `DATA_MODE` (NOVA-006).
- POST/PUT/DELETE endpoints, query-param filtering, pagination envelopes, artificial delays.
- Market-data candle endpoints. Changing existing contracts or mock data.

## Questions

## Handoff
- Created ApiError contract schema, types, unit test (`error.ts`, `error.test.ts`), and exported from `@nova/contracts`.
- Pinned `msw` exact `2.15.0` in `@nova/mocks` and approved scripts.
- Created `handlers/api.ts` (API_BASE_PATH, apiPath, notFound, internalError).
- Implemented Orbit handlers (`/me`, `/strategies`, `/backtests`, `/result`, `/trades`) and Relay handlers (`/broker/accounts`, `/rate-limits`, `/data-jobs`, `/audit`).
- Implemented scenario handlers (`emptyHandlers`, `errorHandlers`).
- Added comprehensive unit tests in `orbit.test.ts`, `relay.test.ts`, `scenarios.test.ts`.
- Updated `CONTRACTS.md` and `STRUCTURE.md`.
- All acceptance checks pass, `pnpm lint`, `pnpm typecheck`, `pnpm test` (29 files, 231 tests), `pnpm build`, `pnpm format:check` all green.

## Review
**Result:** done
**Fixed directly (review: commits):**
- `CONTRACTS.md`: removed the trailing blank line after the new `ApiError` row.
- Merged main (NOVA-011, NOVA-012/028 plan); board and lockfile conflicts resolved.
**Change requests (if sent back):** none.
**Rulebook issues found:** handoff did not use `docs/templates/HANDOFF.md` (no Files/Deviations lines). `frontend/pnpm-workspace.yaml` (`allowBuilds: msw`) was changed outside the Files list; accepted, it is needed for msw's install script.
**Follow-up tasks created:** none.
