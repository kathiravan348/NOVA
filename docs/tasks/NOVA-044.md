# NOVA-044 — Contract parity: JSON Schema from Zod, Pydantic models checked against mocks

**Status:** done · **Owner:** Claude · **Branch:** task/NOVA-044 · **Depends on:** NOVA-043

## Goal
Every contract has a committed JSON Schema generated from Zod, and the backend has a parity test kit that
parses mock JSON with a Pydantic model and validates the model's output against that schema (D34).
Proven on `User` and `ApiError`; later service tasks add their own models with the same kit.

## Read first
- `AGENTS.md` (§7, §8), `docs/DECISIONS.md` (D17, D33, D34), `docs/CONTRACTS.md`
- `frontend/packages/contracts/src/{index.ts,user.ts,error.ts,common.ts}`, `frontend/packages/mocks/data/user.json`

## Files
Create: contracts `src/jsonSchema.test.ts`, `schema/*.json` (generated, one per exported `*Schema` object
schema), `backend/libs/nova_contracts/src/nova_contracts/{common.py,user.py}`,
`backend/libs/nova_contracts/tests/{conftest.py,test_user.py,test_error.py}`,
`backend/libs/nova_testing/{pyproject.toml,src/nova_testing/{__init__.py,parity.py,py.typed}}`
Modify: contracts `package.json` (script `schema:update`), `backend/libs/nova_contracts/{pyproject.toml,src/nova_contracts/__init__.py}`,
`backend/pyproject.toml` (dev dep `jsonschema` pinned), `compose.yaml` (only if the check service needs env for paths),
`docs/CONTRACTS.md` (header line: where schemas live), `docs/STRUCTURE.md`

## Build
1. `jsonSchema.test.ts`: for each contract (list them explicitly; no reflection), `z.toJSONSchema(schema)`
   → `expect(JSON.stringify(json, null, 2) + "\n").toMatchFileSnapshot("../schema/<Name>.json")`.
   `schema:update` = `vitest run -u src/jsonSchema.test.ts`. A stale file fails `pnpm test`.
2. `common.py`: reusable types matching `common.ts` + D17 (id, UTC datetime serialised with `Z`, ISO date,
   paise `int`, segment/exchange/timeframe/side enums). `user.py`: `User` (`extra="forbid"`, strict).
3. `parity.py` helpers: `load_mock(name)` reads `/repo/frontend/packages/mocks/data/<name>.json`;
   `assert_valid(model_output, "User")` validates against `/repo/frontend/packages/contracts/schema/User.json`
   with `jsonschema` (format checking on). Paths from one constant, built with `pathlib`.
4. Tests: `user.json` parses into `User`; `User.model_dump(mode="json")` validates against the schema and
   equals the parsed mock (same keys and values, datetimes with `Z`); an extra field and a naive datetime are rejected. Same for
   `ApiError` using a literal example per error code.

## Acceptance checks
- [x] `pnpm --filter @nova/contracts test` passes; changing a Zod schema without `schema:update` fails it.
- [x] `docker compose run --rm backend-check` passes, including the parity tests.
- [x] Definition of done in `AGENTS.md` §9.

## Out of scope
- Pydantic models for other contracts (added by the service task that serves them).
- Generating Pydantic code from JSON Schema; OpenAPI export.
- The pagination envelope (NOVA-045): do not add a `Page` schema here.

## Questions
_(implementer writes here if blocked)_

## Handoff
**Done:** Built by Claude on Owner request (2026-09-24). 15 wire contracts exported to `schema/*.json`; `User` and
`ApiError` Pydantic models with parity tests.
**Commands run:** contracts tests 147 pass; stale check proven (edited `user.ts` → 1 failure, reverted);
`backend-check` pass (19 tests). **New dependencies:** jsonschema 4.26.0 (in `nova_testing`), types-jsonschema (dev).
**Deviations:** the kit is a workspace lib `nova_testing.parity` (fixture in `conftest.py`) instead of `tests/parity.py`:
pytest importlib mode cannot import sibling test modules, and later services reuse it. Paths resolve from the
file, not a `/repo` constant, so host and Docker both work. `schema/` is in `.prettierignore` (generated).
**Known gaps:** JSON Schema carries no Zod `.refine` rules; Pydantic models must add those as validators.

## Review
**Result:** done
**Fixed directly:** `it.each` over schema objects ran Node out of memory (titles pretty-print Zod graphs) → iterate
names; strict mode never turns str into datetime → `UtcDateTime` parses the `Z` string in its before-validator.
**Rulebook issues found:** none. **Follow-up tasks created:** none.
