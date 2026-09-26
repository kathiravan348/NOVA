# NOVA-091 — Frontend: realtime client; data-job screens update live, polling as fallback

**Status:** done · **Owner:** Claude · **Branch:** task/NOVA-091 · **Depends on:** NOVA-084, NOVA-090

## Goal
Relay keeps one WebSocket open while signed in; the Data jobs list and job page change the moment the
backend changes a job. Polling from NOVA-084 runs only while the socket is down (D57 (1)).

## Read first
- `AGENTS.md`, `docs/DECISIONS.md` D48, D57, `docs/guides/API.md` (WebSocket section)
- `frontend/packages/services/src/{session.ts,config.ts,index.ts}`, `queries/{relay,keys}.ts`
- `frontend/packages/contracts/src/realtime.ts`
- `frontend/apps/nova-relay/vite.config.ts`, `frontend/apps/nova-relay/src/App.tsx` (or the app root that holds providers)

## Files
Create:
- `frontend/packages/services/src/realtime.ts`, `realtime.test.ts`
Modify:
- `frontend/packages/services/src/{index.ts,queries/relay.ts,queries/queries.test.tsx}`
- `frontend/packages/mocks/src/browser.ts` (mock mode: a fake socket that replays job updates, or none — see step 4)
- `frontend/apps/nova-relay/vite.config.ts` (`ws: true` on the `/api` proxy), the Relay app root
- `docs/guides/USER-GUIDE.md` ("updates appear by themselves")

## Build
1. `realtime.ts`: `RealtimeProvider` + `useRealtimeStatus()` (`connecting|open|down`). Opens `ws(s)://<origin>/api/v1/ws`
   only in real mode and only when signed in; reconnect with backoff 1 s → 30 s (+ jitter); answers `ping` with `pong`;
   validates each message with `RealtimeMessageSchema` and drops invalid ones.
2. On `data_job.updated`: `setQueryData(dataJobs.detail(id), job)`; update the row in every loaded list page
   (insert at top if new). No refetch storm.
3. `useDataJob`/`useDataJobs`: the NOVA-084 `refetchInterval` applies only when status is not `open`.
   On reconnect, invalidate `dataJobs.all` once (events missed while down).
4. Mock mode: no socket; polling as today.
5. Relay header shows a small dot with tooltip **Live** / **Reconnecting…** (use an existing `ui-core` status component).

## Acceptance checks
- [ ] Vitest with a fake WebSocket: event updates list + detail without a fetch; reconnect backoff; invalid message ignored; polling only when down.
- [ ] Real stack: start a download, the job page moves from QUEUED → RUNNING → COMPLETED with no reload.
- [ ] 360px + desktop, dark + light for the header dot.
- [ ] Definition of done in `AGENTS.md` §9.

## Out of scope
- Orbit using the socket. Live prices. Plan/pause screens (094).

## Questions

## Handoff
**Done:** `RealtimeProvider` + `useRealtimeStatus` (real mode, signed in), job cache updates from `data_job.updated`, polling only while not `open`, header badge **Connecting… / Live / Reconnecting…**.
**Files changed:** as listed, except `mocks/src/browser.ts` and `queries.test.tsx` (mock mode keeps polling; polling tests live in `realtime.test.ts`).
**Commands run:** `pnpm review:check` → pass. Real stack: socket hello, live job update, 4401 without cookie; header at 360px light + desktop dark.
**New dependencies:** none. **Maps updated:** none. **Guides updated:** USER-GUIDE.
**Known gaps:** Orbit does not open the socket (out of scope).

## Review
**Result:** done (built and merged by Claude at the Owner's request).
**Fixed directly:** first connect shows neutral **Connecting…** instead of **Reconnecting…**.
**Guides checked:** USER-GUIDE matches. **Rulebook issues found:** none. **Follow-up tasks created:** none.
