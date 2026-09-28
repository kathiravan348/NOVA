# NOVA-130 — Agent account contracts, mocks and services (D67)

**Status:** in-progress · **Owner:** ChatGPT · **Branch:** task/NOVA-130 · **Depends on:** —

## Goal
The contracts, mocks and service hooks for the agent role and the approval queue exist (Zod + Pydantic
parity), so the backend (131, 132) and the screens (133) can be built in parallel.

## Read first
- `AGENTS.md`; `docs/DECISIONS.md` D38, D67; `docs/CONTRACTS.md`; every file under Files

## Files
Create:
- `frontend/packages/contracts/src/approval.ts`, `approval.test.ts`
- `backend/libs/nova_contracts/src/nova_contracts/approval.py`, `backend/libs/nova_contracts/tests/test_approval.py`
Modify:
- `frontend/packages/contracts/src/user.ts`, `user.test.ts`, `error.ts`, `index.ts`
- `backend/libs/nova_contracts/src/nova_contracts/user.py`, `error.py`, `__init__.py`
- `frontend/packages/contracts/schema/*.json` (generated: `schema:update`)
- `frontend/packages/services/src/http.ts`, `http.test.ts`, `session.ts`, `session.test.tsx`
- `frontend/packages/services/src/queries/queryClient.ts`, `queries/keys.ts`, `api/relay.ts`
- `frontend/packages/mocks/src/data.ts`, `handlers/index.ts`, `handlers/orbit.ts`
- `frontend/packages/contracts/src/jsonSchema.test.ts` (register the new wire schemas for `schema:update`)
- `docs/CONTRACTS.md`
Create (scope answer, see Questions):
- `frontend/packages/services/src/queries/approvals.ts` (approval + agent hooks; `queries/relay.ts` unchanged)
- `frontend/packages/mocks/src/handlers/approvals.ts`, `handlers/approvals.test.ts` (`handlers/relay.ts` unchanged)

## Build
1. `UserRoleSchema` = enum `super_admin`, `agent`. `ApiErrorCode` gains `forbidden` (403). Python mirrors both.
2. `approval.ts`: `ApprovalStatus` = `pending|done|failed|rejected|expired`; `ApprovalRequest` {`id`, `method`
   (`POST|PUT|PATCH|DELETE`), `path` (starts `/`), `query` (string, may be empty), `body` (any JSON or null),
   `status`, `agentName`, `createdAt`, `decidedAt` (null), `decidedBy` (name, null), `resultStatus` (int, null),
   `resultBody` (string ≤ 8,000, null)}. `AgentAccount` {`id`, `name`, `email`, `enabled`, `createdAt`,
   `lastLoginAt` (null)}. Writes: `AgentAccountCreate` {`name`, `email`, `password` ≥ 12}, `AgentPasswordUpdate`
   {`password` ≥ 12}, `AgentAccessUpdate` {`enabled`}. Schema tests + Pydantic parity tests (D34).
3. `http.ts`: a **202** answer with header `x-nova-approval` throws `ApiRequestError(202, "approval_pending",
   "Sent to Admin for approval (<id>). It runs when Admin approves it.")` (new code in `ApiRequestErrorCode`).
   `shouldRetry` never retries it (a retry would ask twice).
4. `Session` gains `role` (from the sign-in answer; an old stored session without it counts as `super_admin`).
5. API + hooks: `GET /approvals?status=&limit=&cursor=` → `Page<ApprovalRequest>`;
   `POST /approvals/{id}/approve|reject` → `ApprovalRequest`; `GET /agent` → `AgentAccount` (404 = none yet);
   `POST /agent`, `PUT /agent/password`, `PATCH /agent` → `AgentAccount`. Mutations invalidate approvals / agent.
6. Mocks: 3 approvals (one `pending` POST /backtests, one `done`, one `rejected`), an agent account, MSW
   handlers for every endpoint above; mock sign-in with an email starting `agent@` returns role `agent`.

## Acceptance checks
- [x] Schema, parity, handler and http tests pass (202 + header → `approval_pending`, not retried).
- [x] `pnpm review:check` and `docker compose run --rm backend-check` pass. Definition of done (`AGENTS.md` §9).

## Out of scope
- Backend endpoints (131, 132), screens (133). No UI changes. Guides: none (no screen, endpoint or table yet).

## Questions
Scope correction needed: allow modifying `frontend/packages/contracts/src/jsonSchema.test.ts` to register the five new wire schemas for `schema:update`. The task currently permits generated schema files but omits their explicit export registry. Also allow extracting approval handlers/hooks into dedicated files: `handlers/relay.ts` already has 328 lines and `queries/relay.ts` has 275, so adding the requested endpoints/hooks in place conflicts with the 300-line rule. Initial contract/HTTP edits are on `task/NOVA-130`; checks and handoff are not complete.

**Answer (Claude, planner, Owner approved 2026-09-28):** Both yes; the Files list above is updated.
1. Modify `jsonSchema.test.ts`: register the five new wire schemas (`ApprovalRequest`, `AgentAccount`,
   `AgentAccountCreate`, `AgentPasswordUpdate`, `AgentAccessUpdate`), then run `schema:update`.
2. Put the approval + agent hooks in new `queries/approvals.ts` and the MSW handlers in new
   `handlers/approvals.ts` (+ `approvals.test.ts`), registered in `handlers/index.ts`; export the hooks from
   `services/src/index.ts` (shared list file, AGENTS §3). Leave `queries/relay.ts` and `handlers/relay.ts`
   unchanged. The API functions stay in `api/relay.ts` (176 lines, room left). Continue.

## Handoff
**Done:** Agent/approval contracts, parity schemas, role-aware sessions, held-write errors, APIs/hooks and static MSW endpoints.
**Files changed:** `frontend/packages/contracts/src/{approval.ts,approval.test.ts,user.ts,user.test.ts,error.ts,index.ts,jsonSchema.test.ts}`, `frontend/packages/contracts/schema/*.json`.
`backend/libs/nova_contracts/src/nova_contracts/{approval.py,user.py,error.py,__init__.py}`, `backend/libs/nova_contracts/tests/test_approval.py`.
`frontend/packages/services/src/{http.ts,http.test.ts,session.ts,session.test.tsx,index.ts,api/relay.ts,queries/approvals.ts,queries/keys.ts,queries/queryClient.ts}`.
`frontend/packages/mocks/src/{data.ts,handlers/index.ts,handlers/orbit.ts,handlers/approvals.ts,handlers/approvals.test.ts}`.
`docs/{CONTRACTS.md,STRUCTURE.md,tasks/BOARD.md,tasks/NOVA-130.md}`.
**Commands run:** `schema:update`; `pnpm review:check` passed (942 tests, lint, typecheck, formatting, Orbit/Relay/Storybook builds); Docker `backend-check` passed (1055 tests, ruff, format, mypy); `docker compose down`.
**Checked:** UI viewports/themes N/A (no UI changes).
**New dependencies:** none.
**Maps updated:** CONTRACTS, STRUCTURE.
**Guides:** none (contracts/mocks only; real endpoints and screens are later tasks).
**Deviations from task:** approved scope corrections in Questions implemented; relay hooks/handlers unchanged.
**Known gaps:** none in task scope. Host pytest launcher has a missing interpreter; Docker validation passed. Independent review remains.

## Review
_(reviewer — Claude or ChatGPT, ≤ 20 lines — see `docs/templates/REVIEW.md`)_
