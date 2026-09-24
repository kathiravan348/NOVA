# NOVA-043 — Backend skeleton: Compose, uv workspace, NOVA Core health, checks

**Status:** done · **Owner:** Claude · **Branch:** task/NOVA-043 · **Depends on:** NOVA-022

## Goal
`docker compose up` starts PostgreSQL + TimescaleDB, Redis and NOVA Core (`GET /api/v1/health`), and
`docker compose run --rm backend-check` runs ruff, format check, mypy and pytest. Host Python only via uv (D33, D36).

## Read first
- `AGENTS.md` (§5, §8, §9, §10), `docs/DECISIONS.md` (D17, D21, D33, D35), `docs/ARCHITECTURE.md`
- `AGENTS.md` §5a, D36
- `frontend/packages/contracts/src/error.ts` (ApiError shape)

## Files
Create: `compose.yaml`, `.env.example`, `backend/{pyproject.toml,uv.lock,.python-version,Dockerfile,.dockerignore,README.md,scripts/check.sh}`,
`backend/libs/nova_common/{pyproject.toml,src/nova_common/{__init__.py,settings.py,errors.py,py.typed},tests/test_settings.py}`,
`backend/libs/nova_contracts/{pyproject.toml,src/nova_contracts/{__init__.py,error.py,py.typed}}`,
`backend/services/core/{pyproject.toml,src/nova_core/{__init__.py,main.py,py.typed},tests/{test_health.py,test_errors.py}}`
Modify: `.gitignore`, `README.md` (backend section), `docs/STRUCTURE.md` (backend tree)

## Build
1. `backend/pyproject.toml`: uv workspace (`members = ["libs/*", "services/*"]`), Python `==3.12.*`;
   dev deps pinned `==`: ruff, mypy, pytest, httpx. Config: ruff (line 100, rules E,F,I,UP,B,SIM),
   mypy `strict = true` with the pydantic plugin, pytest `testpaths` over every package's `tests/`.
2. Packages (each own `pyproject.toml`, src layout, `py.typed`): `nova_common` (pydantic-settings `Settings`:
   `database_url`, `redis_url`, `log_level`; `errors.py`: `ApiException(status, code, message)` and FastAPI
   handlers that return `ApiError` for it, for request validation (400 `invalid_request`), for unknown routes
   (404 `not_found`) and for unexpected errors (500 `internal`, no stack trace in the body));
   `nova_contracts` (`ApiError` Pydantic models matching `error.ts`, `extra="forbid"`); `nova_core`
   (FastAPI app, routes under `/api/v1`, `GET /health` → `{"status":"ok"}`; not a contract).
3. `Dockerfile`: one image for all services, `python:3.12-slim` (exact tag) + uv (exact version),
   `uv sync --frozen`, non-root user. Code at `/repo/backend`, venv at `/opt/venv` (so the check's `/repo`
   mount replaces the code but not the venv). `.dockerignore` excludes caches and `.venv`. `.python-version` = `3.12`.
   `scripts/check.sh`: `uv sync --frozen`, ruff, format check, mypy per package (tests dirs share names), pytest.
4. `compose.yaml` (repo root): `db` (TimescaleDB on PostgreSQL 17, exact tag, named volume, healthcheck),
   `redis` (exact tag, healthcheck), `core` (uvicorn on 8000, depends on healthy db + redis),
   `backend-check` (profile `tools`; runs `ruff check`, `ruff format --check`, `mypy`, `pytest`, stops on
   first failure; mounts the repo read-only at `/repo`). All ports bind to `127.0.0.1`. Values from `.env`; secrets required
   (`${VAR:?}`). `mem_limit` on every service: db 2g, redis 256m, core 512m, check 1536m (D36).
5. `.env.example`: every variable with a dummy value and a comment; no real secrets. `.gitignore`: Python
   caches, `.venv`. `backend/README.md` ≤ 30 lines: the commands above.
6. Tests: health returns 200 + body; unknown route, bad query and a raised `ApiException` each return the
   `ApiError` shape with the right status; a 500 body has no traceback.

## Acceptance checks
- [x] `docker compose up -d` → db and redis healthy; `curl http://127.0.0.1:8000/api/v1/health` → `{"status":"ok"}`.
- [x] `docker compose run --rm backend-check` passes; mypy strict with zero ignores.
- [x] Frontend untouched; `pnpm review:check` still passes.
- [x] Definition of done in `AGENTS.md` §9.

## Out of scope
- Database tables or Alembic (NOVA-047), auth (NOVA-048), any Kite code, parity tooling (NOVA-044).
- CI pipelines, VPS deploy.

## Questions
_(implementer writes here if blocked)_

## Handoff
**Done:** Built by Claude on Owner request (2026-09-24). Stack up, health + ApiError handlers, backend-check.
**Files changed:** as listed (plus `backend/scripts/check.sh`, `.python-version`, `nova_common/tests/test_settings.py`).
**Commands run:** `docker compose run --rm backend-check` pass (8 tests, 6 s); host `sh scripts/check.sh` pass;
`pnpm review:check` pass (63 s). **Images:** python 3.12.14-slim, uv 0.12.18, timescaledb 2.30.1-pg17, redis 8.10.2-alpine.
**New dependencies:** fastapi 0.141.1, uvicorn 0.53.0, pydantic 2.13.5, pydantic-settings 2.15.0; dev ruff 0.16.8,
mypy 2.3.1, pytest 9.1.1, httpx2 2.13.1 (Starlette's TestClient deprecates `httpx` in favour of `httpx2`).
**Deviations:** `NOVA_DATABASE_URL`/`NOVA_REDIS_URL` are `SecretStr`; 405 etc. map to `invalid_request` with their own status.
**Known gaps:** image carries dev tools (one image for all, Phase 1); `postgresql+psycopg` driver arrives with NOVA-047.

## Review
**Result:** done
**Fixed directly:** removed unused `type: ignore`s (pydantic plugin types `BaseSettings`); dropped `env_file` from
backend services so the DB password reaches only `db` and the composed URL.
**Rulebook issues found:** none. Host uv needs the full interpreter path in sandboxed shells (junction unreadable);
the Owner's own shells are unaffected.
**Follow-up tasks created:** none.
