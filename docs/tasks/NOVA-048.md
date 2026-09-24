# NOVA-048 — NOVA Core: super-admin auth, `/me`, audit, gateway routing

**Status:** done · **Owner:** Claude · **Branch:** task/NOVA-048 · **Depends on:** NOVA-044, NOVA-047

## Goal
NOVA Core signs the super-admin in and out with a session cookie, serves `/me` and the paged audit log, writes
audit entries, and forwards every other `/api/v1/*` call to the owning service with the signed-in user (D38).

## Read first
- `AGENTS.md` (§5, §5a, §8, §10), `docs/DECISIONS.md` (D12, D23, D32, D34, D37, D38), `docs/CONTRACTS.md`
- `backend/services/core/src/nova_core/main.py`, `backend/libs/nova_db/src/nova_db/models/{auth.py,data.py}`

## Files
Contracts: `frontend/packages/contracts/src/{auth.ts,auth.test.ts,error.ts,error.test.ts,index.ts,jsonSchema.test.ts}`,
`schema/{LoginRequest,ApiError}.json`; `backend/libs/nova_contracts/src/nova_contracts/{auth.py,audit.py,page.py,error.py,__init__.py}`
+ `tests/{test_auth.py,test_audit.py}`
DB: `nova_db/models/auth.py` (`AuthSession`), `nova_db/audit.py`, `nova_db/migrations/versions/rev0002_auth_sessions.py`
Testing: `backend/libs/nova_testing/src/nova_testing/db.py` (fixtures moved from `nova_db/tests/conftest.py`)
Core: `nova_core/{settings.py,passwords.py,sessions.py,deps.py,auth_routes.py,audit_routes.py,gateway.py,cli.py,__main__.py,main.py}`,
`nova_common/paging.py` (keyset cursors, shared), `backend/Dockerfile` (uvicorn `--factory`),
`services/core/tests/{conftest.py,test_passwords.py,test_auth.py,test_audit.py,test_gateway.py,test_cli.py}` (+ existing tests)
Also: `compose.yaml`, `.env.example`, `docs/{CONTRACTS.md,DECISIONS.md,STRUCTURE.md}`, `backend/README.md`

## Build
1. Contracts: `LoginRequest { email, password (1–200) }`; ApiError code `unauthorized` (401). Regenerate schemas.
   Pydantic `LoginRequest`, `AuditEntry` (refinement: target pair), generic `Page[T]`; parity tests vs mocks/schemas.
2. `auth_sessions (id = sha256(token) hex, user_id, created_at, expires_at, ip, user_agent)`; migration 0002.
3. Passwords: stdlib `hashlib.scrypt` (n=2^15, r=8, p=1, 16-byte salt), stored `scrypt$n$r$p$salt$hash`; constant-time verify.
4. `POST /auth/login` → `User` + cookie `nova_session` (HttpOnly, SameSite=Lax, `Secure` from settings, 12 h).
   Wrong email or password → 401 `unauthorized`, same message. `POST /auth/logout` → 204, cookie cleared.
   `GET /me` → `User`. Every route except `/health` and `/auth/login` needs a live session.
5. Audit: `nova_db.audit.record(...)` writes `audit_entries`; login (success and failure), logout. `GET /audit`
   → `Page<AuditEntry>` newest first, keyset cursor over `(at, id)`, `limit` 1–200 (D32).
6. Gateway: prefixes `/broker`, `/data-jobs`, `/market-data`, `/strategies`, `/backtests` → service base URLs from
   `NOVA_*_URL`. Forward method, path, query, JSON body; drop cookies; add `X-Nova-User-Id`, `X-Nova-User-Name`,
   `X-Nova-Internal-Token`. No URL configured or upstream down → 502 `internal`.
7. CLI: `python -m nova_core create-admin --email --name` (password from `NOVA_ADMIN_PASSWORD` or a prompt).

## Acceptance checks
- [x] Tests: login/logout/me, expired session, wrong password, audit rows + page walk, gateway headers/401/502, CLI.
- [x] `docker compose run --rm backend-check` and frontend `pnpm review:check` pass. Definition of done in `AGENTS.md` §9.

## Out of scope
- Login screen in real mode (058), roles beyond super-admin, login throttling, the services behind the gateway.

## Questions
_(implementer writes here if blocked)_

## Handoff
**Done:** Built by Claude on Owner request (2026-09-24). Sign-in/out, `/me`, paged `/audit`, audit writes, gateway, CLI.
**Commands run:** `backend-check` pass (101 tests); `pnpm review:check` pass (92 files); end-to-end on the stack:
create-admin → login → me → audit → gateway 502 → logout 204 (test user removed afterwards).
**New dependencies:** none new (httpx2 2.13.1 moves from dev to nova-core runtime for the gateway).
**Deviations:** cursor helpers live in `nova_common.paging` (every service pages lists); uvicorn starts
`nova_core.main:app_factory` so settings are read at start-up, not import. Test constants are fixtures
(`credentials`, `internal_token`): pytest importlib mode cannot import `conftest`.
**Known gaps:** no login throttling (out of scope); scrypt makes core tests ~10 s.

## Review
**Result:** done
**Fixed directly:** unknown email checks a dummy hash (same timing as a wrong password); header `X-Nova-User-Name` is
percent-encoded (names may be non-ASCII); the one-off e2e admin was deleted from the local database.
**Rulebook issues found:** none. **Follow-up tasks created:** none.
