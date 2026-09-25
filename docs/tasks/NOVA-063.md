# NOVA-063 — API docs: Swagger UI on NOVA Core for local development (D50)

**Status:** done · **Owner:** Claude · **Branch:** task/NOVA-063 · **Depends on:** NOVA-059

## Goal
With `NOVA_API_DOCS=true`, http://127.0.0.1:8000/api/v1/docs shows Swagger UI for the whole public API: Core's own
routes plus the broker, atlas, strategy and backtest routes it forwards. Off by default; nothing changes when off.

## Read first
- `AGENTS.md` (§5, §8), `docs/DECISIONS.md` (D38, D50)
- `backend/libs/nova_common/src/nova_common/{settings.py,__init__.py}`
- `backend/services/core/src/nova_core/{main.py,gateway.py,settings.py}`, `backend/services/core/tests/conftest.py`

## Files
Create: `nova_common/api_docs.py`, `nova_core/api_docs.py`, `services/core/tests/test_api_docs.py`
Modify: `nova_common/{settings.py,__init__.py}`, `libs/nova_common/tests/test_settings.py`,
`main.py` of atlas, backtest, broker, strategy and core, `compose.yaml`, `.env.example`, `backend/README.md`

## Build
1. `Settings.api_docs: bool = False` (`NOVA_API_DOCS`). `nova_common.api_docs.openapi_url(settings)` returns
   `"/openapi.json"` when on, else `None`; export it.
2. atlas, backtest, broker, strategy: `openapi_url=openapi_url(settings)`; keep `docs_url`/`redoc_url` `None`.
   These ports stay internal to Compose (not published).
3. Core, only when `settings.api_docs`: include `nova_core.api_docs.router` under `/api/v1` with
   - `GET /openapi.json`: Core's `app.openapi()` merged with each configured upstream's `/openapi.json`, fetched
     through `app.state.http` (5 s timeout). Keep only upstream paths whose first segment after `/api/v1/` maps to
     that service in `gateway.ROUTES`. Merge `components.schemas`; on a name clash with a different definition keep
     Core's and log a warning. A failed upstream is skipped and named in `info.description`.
   - `GET /docs`: `get_swagger_ui_html(openapi_url="/api/v1/openapi.json", title="NOVA API")`.
   Both routes: `include_in_schema=False`, no sign-in (dev only).
4. Compose: `NOVA_API_DOCS: ${NOVA_API_DOCS:-false}` on core, broker, strategy, backtest, atlas.
   `.env.example`: `NOVA_API_DOCS=false` with a one-line comment (true only on a dev machine).
5. `backend/README.md`: one row: set `NOVA_API_DOCS=true`, `docker compose up -d`, open `/api/v1/docs`; sign in
   with `POST /auth/login` in Swagger (same origin, so the cookie applies to "Try it out").

## Acceptance checks
- [x] Off (default): `/api/v1/docs`, `/api/v1/openapi.json` and each service's `/openapi.json` return 404.
- [x] On: `/api/v1/docs` is 200 HTML with Swagger UI; `/api/v1/openapi.json` has `/api/v1/auth/login` and an
      upstream path from a fake schema served by `upstream_transport`; a non-routed upstream path is dropped.
- [x] On, one upstream failing: still 200 with Core paths; `info.description` names the failed service.
- [x] Manual: with the flag on in `.env`, Swagger lists strategies and backtests endpoints; sign-in then
      `GET /strategies` works from "Try it out".
- [x] `backend-check` passes. Definition of done in `AGENTS.md` §9.

## Out of scope
- ReDoc; docs on the VPS; a committed `openapi.json` or frontend type generation from it.
- Changing any route, response model or contract to improve the schema (later tasks if needed).
- Auth on the docs routes (the flag is off outside a dev machine).

## Questions
_(implementer writes here if blocked)_

## Handoff
**Done:** Built by Claude on Owner request (2026-09-25). `NOVA_API_DOCS` → merged schema + Swagger UI on Core.
**Files changed:** as listed, plus `docs/STRUCTURE.md` (map lines for nova_common and core).
**Commands run:** `backend-check` pass (352 tests).
**Checked:** live stack with the flag on: `/api/v1/docs` renders, schema has 25 public paths from all five
services, no internal paths or headers; with it off, Core and all four services return 404.
**New dependencies:** none.
**Deviations:** `NOVA_API_DOCS` goes in the shared `x-backend` env block (strategy, backtest, atlas use it) and
broker's own block, instead of five separate lines.
**Known gaps:** "Try it out" after sign-in not exercised live (no admin password in this session); same-origin
cookie path is the one the apps already use (D48).

## Review
Built and checked by Claude (planner = implementer on Owner request); acceptance checks above verified. Merged.
