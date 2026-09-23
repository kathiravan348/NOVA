# NOVA-043 — Backend skeleton: Compose, uv workspace, NOVA Core health, checks

**Status:** planned · **Owner:** — · **Branch:** task/NOVA-043 · **Depends on:** NOVA-022

## Goal
`docker compose up` starts PostgreSQL + TimescaleDB, Redis and NOVA Core (`GET /api/v1/health`), and
`docker compose run --rm backend-check` runs ruff, format check, mypy and pytest. No host Python (D33).

## Read first
- `AGENTS.md` (§5, §8, §9, §10), `docs/DECISIONS.md` (D17, D21, D33, D35), `docs/ARCHITECTURE.md`
- `frontend/packages/contracts/src/error.ts` (ApiError shape)

## Files
Create: `compose.yaml`, `.env.example`, `backend/{pyproject.toml,uv.lock,Dockerfile,.dockerignore,README.md}`,
`backend/libs/nova_common/{pyproject.toml,src/nova_common/{__init__.py,settings.py,errors.py,py.typed}}`,
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
   `uv sync --frozen`, non-root user. `.dockerignore` excludes caches and `.venv`.
4. `compose.yaml` (repo root): `db` (TimescaleDB on PostgreSQL 17, exact tag, named volume, healthcheck),
   `redis` (exact tag, healthcheck), `core` (uvicorn on 8000, depends on healthy db + redis),
   `backend-check` (profile `tools`; runs `ruff check`, `ruff format --check`, `mypy`, `pytest`, stops on
   first failure; mounts the repo read-only at `/repo`). All ports bind to `127.0.0.1`. Values from `.env`.
5. `.env.example`: every variable with a dummy value and a comment; no real secrets. `.gitignore`: Python
   caches, `.venv`. `backend/README.md` ≤ 30 lines: the commands above.
6. Tests: health returns 200 + body; unknown route, bad query and a raised `ApiException` each return the
   `ApiError` shape with the right status; a 500 body has no traceback.

## Acceptance checks
- [ ] `docker compose up -d` → db and redis healthy; `curl http://127.0.0.1:8000/api/v1/health` → `{"status":"ok"}`.
- [ ] `docker compose run --rm backend-check` passes; mypy strict with zero ignores.
- [ ] Frontend untouched; `pnpm review:check` still passes.
- [ ] Definition of done in `AGENTS.md` §9.

## Out of scope
- Database tables or Alembic (NOVA-047), auth (NOVA-048), any Kite code, parity tooling (NOVA-044).
- CI pipelines, VPS deploy.

## Questions
_(implementer writes here if blocked)_

## Handoff
_(implementer, ≤ 20 lines — see `docs/templates/HANDOFF.md`)_

## Review
_(Claude, ≤ 20 lines — see `docs/templates/REVIEW.md`)_
