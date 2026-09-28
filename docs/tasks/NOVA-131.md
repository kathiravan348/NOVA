# NOVA-131 — Core: agent role, deny-by-default gateway, held writes (D67, migration 0020)

**Status:** planned · **Owner:** — · **Branch:** task/NOVA-131 · **Depends on:** NOVA-130

## Goal
An `agent` user can sign in; the gateway refuses anything not on its rule table (broker always), passes free
reads, and saves every other write as a `pending` approval request instead of running it.

## Read first
- `AGENTS.md`; `docs/DECISIONS.md` D38, D67; `docs/guides/API.md` (Core + gateway); every file under Files

## Files
Create:
- `backend/libs/nova_db/src/nova_db/migrations/versions/rev0020_agent_role_approvals.py`
- `backend/services/core/src/nova_core/agent_rules.py`, `backend/services/core/tests/test_agent_rules.py`
- `backend/services/core/tests/test_agent_gateway.py`
Modify:
- `backend/libs/nova_db/src/nova_db/models/auth.py`, `models/__init__.py`, `backend/libs/nova_db/tests/test_migrations.py`
- `backend/services/core/src/nova_core/deps.py`, `auth_routes.py`, `gateway.py`, `realtime.py`, `audit_routes.py`
- `backend/services/core/tests/conftest.py`, `test_auth.py`
- `docs/guides/API.md`, `docs/guides/DATABASE.md`

## Build
1. Migration 0020: seed role `agent` ("Agent"); `users.disabled_at` (timestamptz, null); table
   `approval_requests` (`id` `apr_…`, `agent_id` → users cascade, `method` check in POST/PUT/PATCH/DELETE,
   `path`, `query` (text, default ''), `body` JSONB null, `status` check (D67 five values) default `pending`,
   `created_at`, `decided_at`, `decided_by` → users set null, `result_status` int, `result_body` text;
   index (`status`, `created_at`)). Models to match.
2. `deps.py`: `user_role(db, user_id)` → `super_admin` | `agent` | None; `require_user` accepts both (agent only
   when `disabled_at` is null); new `AdminOnly` dependency (403 `forbidden` for the agent); `to_contract` returns
   the real role. Sign-in and `/ws` accept an enabled agent. `/audit` stays open to both.
3. `agent_rules.py`: `classify(method, path) -> "free" | "held" | "blocked"` per D67 (2)–(4), path relative to
   `/api/v1`. `broker` and unknown prefixes → blocked for every method. Only `POST /data-jobs/plan` is a free write.
   Test: every key of `gateway.ROUTES` has a rule, and `broker` is blocked.
4. `gateway.py`: split out `send_upstream(request_app, settings, *, method, path, query, body, content_type,
   user_id, user_name, ip)` (used by 132 to replay). For an agent: blocked → 403 "The agent account may not
   do this"; held → insert `approval_requests` (body must be JSON ≤ 64 KB, else 400), audit
   `approval.request` ("Asked: POST /backtests"), answer **202** `ApprovalRequest` + header `x-nova-approval: <id>`.
   The super-admin path is unchanged.
5. Tests: agent GET passes; agent POST /backtests → 202 and nothing reaches the service; agent GET /broker/accounts
   → 403; disabled agent cannot sign in; super-admin unchanged. Update API.md (roles, 403, 202) and DATABASE.md.

## Acceptance checks
- [ ] Tests above pass; `docker compose run --rm backend-check` passes. Definition of done (`AGENTS.md` §9).

## Out of scope
- Approve/reject/list and agent-account endpoints (132); screens (133). Changing any service other than Core.

## Questions
_(implementer writes here if blocked)_

## Handoff
_(implementer, ≤ 20 lines — see `docs/templates/HANDOFF.md`)_

## Review
_(reviewer — Claude or ChatGPT, ≤ 20 lines — see `docs/templates/REVIEW.md`)_
