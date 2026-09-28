# NOVA-130 — Agent account contracts, mocks and services (D67)

**Status:** planned · **Owner:** — · **Branch:** task/NOVA-130 · **Depends on:** —

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
- `frontend/packages/services/src/queries/queryClient.ts`, `queries/relay.ts`, `queries/keys.ts`, `api/relay.ts`
- `frontend/packages/mocks/src/data.ts`, `handlers/relay.ts`, `handlers/relay.test.ts`, `handlers/orbit.ts`
- `docs/CONTRACTS.md`

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
- [ ] Schema, parity, handler and http tests pass (202 + header → `approval_pending`, not retried).
- [ ] `pnpm review:check` and `docker compose run --rm backend-check` pass. Definition of done (`AGENTS.md` §9).

## Out of scope
- Backend endpoints (131, 132), screens (133). No UI changes. Guides: none (no screen, endpoint or table yet).

## Questions
_(implementer writes here if blocked)_

## Handoff
_(implementer, ≤ 20 lines — see `docs/templates/HANDOFF.md`)_

## Review
_(reviewer — Claude or ChatGPT, ≤ 20 lines — see `docs/templates/REVIEW.md`)_
