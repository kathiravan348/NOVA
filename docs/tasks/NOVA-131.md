# NOVA-131 — Core: agent role, deny-by-default gateway, held writes (D67, migration 0020)

**Status:** done · **Owner:** Claude · **Branch:** task/NOVA-131 · **Depends on:** NOVA-130

## Goal
An `agent` user can sign in; the gateway refuses anything not on its rule table (broker always), passes free
reads, and saves every other write as a `pending` approval request instead of running it.

## Read first
- `AGENTS.md`; `docs/DECISIONS.md` D38, D67; `docs/guides/API.md` (Core + gateway); every file under Files

## Files
Create:
- `backend/libs/nova_db/src/nova_db/migrations/versions/rev0020_agent_role_approvals.py`
- `backend/services/core/src/nova_core/agent_rules.py`, `core/tests/test_agent_rules.py`, `test_agent_gateway.py`
Modify:
- `backend/libs/nova_db/src/nova_db/models/auth.py`, `models/__init__.py`, `enums.py`, `backend/libs/nova_db/tests/test_migrations.py`
- Audit enums (Q1): `frontend/packages/contracts/src/audit.ts`, `schema/AuditEntry.json` (`schema:update`),
  `backend/libs/nova_contracts/src/nova_contracts/audit.py`, `frontend/apps/nova-relay/src/lib/labels.ts`
- `backend/services/core/src/nova_core/deps.py`, `auth_routes.py`, `gateway.py`, `realtime.py`, `audit_routes.py`
- `backend/services/core/tests/conftest.py`, `test_auth.py`
- `docs/guides/API.md`, `docs/guides/DATABASE.md`, `docs/STRUCTURE.md` (Core line: agent rules + held writes)

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
   `approval.request` ("Asked: POST /backtests", target `approval_request`), answer **202** `ApprovalRequest` +
   header `x-nova-approval: <id>`. The super-admin path is unchanged.
5. Tests: agent GET passes; agent POST /backtests → 202 and nothing reaches the service; agent GET /broker/accounts
   → 403; disabled agent cannot sign in; super-admin unchanged. Update API.md (roles, 403, 202) and DATABASE.md.

## Acceptance checks
- [x] Tests pass; `backend-check` and `pnpm review:check` pass (audit enums changed). Done per `AGENTS.md` §9.

## Out of scope
- Approve/reject/list, agent-account endpoints (132); screens (133). Other services; contracts beyond audit enums.

## Questions
- Q1 (ChatGPT, 2026-09-28): `approval.request` missing from `AUDIT_ACTIONS` / the CHECK. **Answer (Claude):** yes.
  Add all six D67 actions now (`approval.request|approve|reject`, `agent.create|password|access`) and target
  type `approval_request` to contracts (TS + Python), `enums.py` and 0020 (rev0016 pattern: frozen OLD tuples,
  drop + recreate `ck_audit_entries_action` and `_target_type`; downgrade deletes those rows first). `labels.ts`:
  a label per action, groups `approval` "Approvals", `agent` "Agent account". 132 then needs no migration.

## Handoff
**Done:** enabled agent sign-in/session checks, explicit gateway rules, held writes and migration 0020; Q1 implemented.
**Files changed:** `backend/libs/nova_db/src/nova_db/migrations/versions/rev0020_agent_role_approvals.py`, `backend/libs/nova_db/src/nova_db/models/auth.py`, `backend/libs/nova_db/src/nova_db/models/__init__.py`, `backend/libs/nova_db/src/nova_db/enums.py`, `backend/libs/nova_db/tests/test_migrations.py`.
`backend/services/core/src/nova_core/deps.py`, `backend/services/core/src/nova_core/auth_routes.py`, `backend/services/core/src/nova_core/gateway.py`, `backend/services/core/src/nova_core/agent_rules.py`, `backend/services/core/src/nova_core/realtime.py`, `backend/services/core/tests/conftest.py`, `backend/services/core/tests/test_auth.py`, `backend/services/core/tests/test_agent_rules.py`, `backend/services/core/tests/test_agent_gateway.py`.
`backend/libs/nova_contracts/src/nova_contracts/audit.py`, `frontend/packages/contracts/src/audit.ts`, `frontend/packages/contracts/schema/AuditEntry.json`, `frontend/apps/nova-relay/src/lib/labels.ts`, `docs/guides/API.md`, `docs/guides/DATABASE.md`, `docs/STRUCTURE.md`, `docs/tasks/BOARD.md`, `docs/tasks/NOVA-131.md`.
**Commands run:** schema:update (52 pass); pnpm review:check (format/lint/typecheck/test/build pass); focused Core tests (167 pass); final docker compose run --rm backend-check (ruff/format/mypy pass, 1173 tests pass).
**Checked:** 360px / desktop / dark / light: N/A (no component or screen layout changes).
**New dependencies:** none. **Maps updated:** STRUCTURE. **Guides updated:** API, DATABASE.
**Replay helper:** send_upstream takes full /api/v1 path, raw query string, bytes body, optional content type; identity/IP passed explicitly.
**Deviations from task:** audit_routes.py needs no edit; its SignedIn dependency now admits enabled agents.
**Known gaps / open questions:** none within 131; approval decisions and account management remain in 132.

## Review
**Result:** done
**Reviewer / built by:** Claude / ChatGPT. **Self-review:** no.
**Fixed directly (review: commits):**
- Held `path` is now stored relative to `/api/v1` (`/backtests`), matching the contract mocks and the audit summary;
  `send_upstream` takes that relative path, so 132 replays `row.path` as stored. Test and guides updated.
**Checked:** rules table (broker + unknown prefixes blocked, only `POST /data-jobs/plan` free, dot/`%` paths
blocked); held body ≤ 64 KB JSON, nothing sent upstream; disabled agent refused on sign-in, HTTP and `/ws`;
migration 0020 audit CHECKs follow rev0016 and downgrade cleans up; super-admin forwarding unchanged.
Kept the catch-all `UnknownRoute` (403 for the agent on unknown `/api/v1` paths, 404 otherwise): correct,
and it only runs for requests no other route matched.
**Change requests:** none.
**Guides checked:** API.md, DATABASE.md match the diff (path wording fixed directly). STRUCTURE updated.
**Rulebook issues found:** none. `backend-check` 1173 pass (one run hit a timing flake in
`test_realtime.py::test_quick_updates_of_one_job_are_coalesced`, passed on rerun); `pnpm review:check` passes.
**Follow-up tasks created:** none.
