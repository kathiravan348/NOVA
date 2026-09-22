# NOVA-006 — Services layer: `DATA_MODE` switch, typed API client, TanStack Query hooks

**Status:** done · **Owner:** Claude · **Branch:** task/NOVA-006 · **Depends on:** NOVA-024

## Goal
`@nova/services` is the only way apps get data: a typed `apiGet` that validates every response with its contract schema, one function per endpoint, and a TanStack Query hook per function. `VITE_DATA_MODE` picks mock (MSW-served, default) or real (refused in Stage A).

## Read first
- `AGENTS.md` (§1, §5, §7), `docs/ARCHITECTURE.md` (services line), `docs/DECISIONS.md` (D17, D21, D22), `docs/CONTRACTS.md`
- `frontend/packages/services/{package.json,tsconfig.json,src/index.ts}`
- `frontend/packages/contracts/src/{index.ts,error.ts}`, `frontend/packages/mocks/src/handlers/{index.ts,orbit.test.ts}` (MSW test pattern)
- `frontend/packages/ui-trading/vitest.config.ts` (jsdom config to copy)

## Files
Create in `frontend/packages/services/`: `vitest.config.ts`, `vitest.setup.ts`, and in `src/`:
- `config.ts`, `http.ts`, `http.test.ts`
- `api/orbit.ts`, `api/relay.ts`, `api/api.test.ts`
- `queries/keys.ts`, `queries/orbit.ts`, `queries/relay.ts`, `queries/queryClient.ts`, `queries/queries.test.tsx`
Modify: `frontend/packages/services/{package.json,tsconfig.json,src/index.ts}`, `frontend/pnpm-lock.yaml`, `docs/STRUCTURE.md`

## Build
1. `package.json`: deps `@tanstack/react-query` 5.x (exact latest stable), `zod` 4.6.5; peer `react` 18.3.1; devDeps `@nova/mocks` (`workspace:*`), `msw` 2.15.0, `vitest` 3.2.7; script `"test": "vitest run"`. `tsconfig.json`: `"types": ["vite/client"]`, `"jsx": "react-jsx"`, include `vitest.setup.ts`.
2. `config.ts`: `type DataMode = "mock" | "real"`; `getDataMode()` reads `import.meta.env.VITE_DATA_MODE` (default `"mock"`, anything else throws). `getApiBaseUrl()`: mock → `globalThis.location?.origin ?? "http://localhost"`; real → throws `Error("DATA_MODE=real is not available in Stage A")`.
3. `http.ts`: `class ApiRequestError extends Error { status; code: ApiErrorCode | "invalid_response" | "network" }`. `apiGet<T>(path: string, schema: z.ZodType<T>, init?: { signal?: AbortSignal }): Promise<T>` builds `new URL("/api/v1" + path, getApiBaseUrl())`, fetches, on non-2xx parses `ApiErrorSchema` (fallback code `internal`) and throws; on 2xx `schema.safeParse` → data or `ApiRequestError(status, "invalid_response")`. Fetch rejection → code `network`.
4. `api/orbit.ts`: `getMe`, `listStrategies`, `getStrategy(id)`, `listBacktests`, `getBacktest(id)`, `getBacktestResult(runId)`, `listBacktestTrades(runId)`. `api/relay.ts`: `listBrokerAccounts`, `getBrokerAccount(id)`, `listRateLimits`, `listDataJobs`, `getDataJob(id)`, `listAuditEntries`. Each is one `apiGet` with the path from `CONTRACTS.md` and the matching schema (`XSchema.array()` for lists); ids through `encodeURIComponent`.
5. `queries/keys.ts`: `queryKeys` factory (`queryKeys.strategies.all`, `.detail(id)`, `queryKeys.backtests.result(id)`, …). `queries/orbit.ts` / `relay.ts`: `useMe`, `useStrategies`, `useStrategy(id)`, `useBacktests`, `useBacktest(id)`, `useBacktestResult(id)`, `useBacktestTrades(id)`, `useBrokerAccounts`, `useBrokerAccount(id)`, `useRateLimits`, `useDataJobs`, `useDataJob(id)`, `useAuditEntries`: `useQuery({ queryKey, queryFn: ({ signal }) => fn(…, { signal }) })`; id hooks set `enabled: Boolean(id)`.
6. `queryClient.ts`: `createQueryClient()` with `staleTime` 30 s, `refetchOnWindowFocus: false`, `retry`: no retry when `ApiRequestError.status` is 4xx, otherwise up to 1.
7. `index.ts` exports all of the above plus types. No React context/provider here (apps add `QueryClientProvider` in NOVA-013). Screens never import `@nova/mocks`.
8. Tests (jsdom; `setupServer(...handlers)` from `@nova/mocks` + `msw/node`): every api function returns data equal to the mock; unknown id → `ApiRequestError` status 404 code `not_found`; `server.use(...errorHandlers)` → code `internal`; a handler returning `{}` for `/me` → `invalid_response`; `VITE_DATA_MODE=real` (`vi.stubEnv`) → throws. Hooks via `renderHook` + `QueryClientProvider`: `useStrategies` resolves to the mock, `useStrategy("")` stays idle, error scenario sets `isError` without retry on 404.

## Acceptance checks
- [ ] `pnpm --filter @nova/services test` passes and root `pnpm test` runs it; every endpoint in `CONTRACTS.md` has a function, a hook and a test.
- [ ] `pnpm build` passes; no `msw/node` or `@nova/mocks` import outside `*.test.*`.
- [ ] Definition of done in `AGENTS.md` §9 (stories n/a).

## Out of scope
- Starting the MSW worker, `mockServiceWorker.js`, `QueryClientProvider` in apps (NOVA-013). Mutations, pagination, auth headers, real API calls.

## Questions

## Handoff
**Done:** `@nova/services`: schema-validated `apiGet`, 13 endpoint functions, 13 query hooks, `createQueryClient`.
**Files changed:** as listed (plus `vitest.config.ts`, `vitest.setup.ts`).
**Commands run:** lint / typecheck / test / build / format:check → all pass (yes)
**Checked:** n/a (no UI)
**New dependencies:** `@tanstack/react-query@5.103.2` (in stack, AGENTS §5).
**Maps updated:** STRUCTURE.
**Deviations from task:** hook test wraps fetch to drop the `AbortSignal`: jsdom's AbortSignal is rejected by Node's fetch (test-only).
**Known gaps:** none.

## Review
**Result:** done (built by Claude while Gemini is offline; self-reviewed against the diff)
**Fixed directly (review: commits):** none.
**Rulebook issues found:** none.
**Follow-up tasks created:** none.
