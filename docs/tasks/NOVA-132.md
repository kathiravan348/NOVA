# NOVA-132 — Core: approve/reject held requests, agent account endpoints (D67)

**Status:** in-progress · **Owner:** ChatGPT · **Branch:** task/NOVA-132 · **Depends on:** NOVA-131

## Goal
The super-admin can list, approve (which runs the saved request as the agent) and reject agent requests, and
create the agent account, set its password and turn its access on or off — all over the API.

## Read first
- `AGENTS.md`; `docs/DECISIONS.md` D38, D67; `docs/guides/API.md` (Core); every file under Files

## Files
Create:
- `backend/services/core/src/nova_core/approval_routes.py`, `backend/services/core/tests/test_approvals.py`
- `backend/services/core/src/nova_core/agent_routes.py`, `backend/services/core/tests/test_agent_account.py`
Modify:
- `backend/services/core/src/nova_core/main.py`, `cli.py` (share `create_user(role=…)` with `create-admin`)
- `backend/services/core/src/nova_core/sessions.py` (revoke every session of a user)
- `backend/services/core/tests/test_cli.py`
- `docs/guides/API.md`

## Build
1. `GET /approvals?status=&limit=&cursor=`: newest first, `Page<ApprovalRequest>`. Super-admin sees all; the
   agent sees only its own. Before answering, `pending` rows older than 30 min become `expired`.
2. `POST /approvals/{id}/approve` (`AdminOnly`): claim it with one committed conditional update
   `SET decided_at=now(), decided_by=:admin WHERE id=:id AND status='pending' AND decided_at IS NULL AND
   created_at > now() - 30 min` → 0 rows = 400 "Already decided or expired" (so it can never run twice). Then `gateway.send_upstream(...)` as the agent (its id and name), store `result_status` and
   `result_body` (first 8,000 chars), status `done` (2xx) or `failed`, `decided_at`, `decided_by`. Audit
   `approval.approve` ("Approved POST /backtests → 201"). An upstream error (no answer) → `failed` with the message.
3. `POST /approvals/{id}/reject` (`AdminOnly`): `pending` and unclaimed (`decided_at IS NULL`) → `rejected`,
   else 400; audit `approval.reject`. Expiry (step 1) also only touches unclaimed rows.
4. `agent_routes.py` (all `AdminOnly`): `GET /agent` (404 none); `POST /agent` (only one agent may exist, 400
   otherwise; email not already used; audit `agent.create`); `PUT /agent/password` (revokes its sessions; audit
   `agent.password`); `PATCH /agent {enabled}` (sets/clears `disabled_at`; off revokes its sessions; audit
   `agent.access` "Agent access off"). Passwords use the same rules and hash as `create-admin`.
5. Tests: approve runs once (second approve 400), result stored, expired cannot be approved, agent cannot
   approve/reject or call `/agent` (403), turning access off ends a live agent session. API.md rows for all.

## Acceptance checks
- [ ] Tests above pass; `docker compose run --rm backend-check` passes. Definition of done (`AGENTS.md` §9).

## Out of scope
- Screens (133). Push of new approvals over `/ws` (the Approvals page polls). More than one agent account.

## Questions
The new endpoints cause `test_schema_groups_operations_by_area` to fail: `/agent` and `/approvals`
are grouped as `Other` by `nova_core/api_docs.py`. May the planner add that file to Modify so these
Core endpoints can be grouped under Auth? The task also creates four files but omits `docs/STRUCTURE.md`
from Modify; please add it for the required map update (AGENTS §4). Implementation remains in-progress.

## Handoff
**Progress:** approval and agent endpoints implemented; stopped on scope question above.
**Files changed:** `approval_routes.py`, `agent_routes.py`, `main.py`, `cli.py`, `sessions.py`;
`test_approvals.py`, `test_agent_account.py`, `test_cli.py`; `docs/guides/API.md`; task + board.
**Checks:** Core ruff lint/format pass; Docker Core mypy pass; affected tests 69 passed.
**Core suite:** initial run 181 passed / 9 failed; eight method-denial failures fixed and verified.
**Remaining:** Swagger grouping failure requires `api_docs.py`; full backend gate still to run.
**Frontend:** `fnm exec --using=24 -- pnpm --dir frontend review:check` passed (942 tests + build).
**UI checks:** not applicable (backend only).
**New dependencies:** none.
**Maps:** STRUCTURE update needs scope addition; CONTRACTS/COMPONENTS unchanged.
**Guides updated:** API. USER-GUIDE/DATABASE unchanged.
**Environment:** host mypy cannot launch the existing venv Python; used pinned Docker runtime.
**Status:** in-progress, ChatGPT; no self-review or merge.

## Review
_(reviewer — Claude or ChatGPT, ≤ 20 lines — see `docs/templates/REVIEW.md`)_
