# NOVA-044 — Contract parity: JSON Schema from Zod, Pydantic models checked against mocks

**Status:** planned · **Owner:** — · **Branch:** task/NOVA-044 · **Depends on:** NOVA-043

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
`backend/libs/nova_contracts/tests/{conftest.py,parity.py,test_user.py,test_error.py}`
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
- [ ] `pnpm --filter @nova/contracts test` passes; changing a Zod schema without `schema:update` fails it.
- [ ] `docker compose run --rm backend-check` passes, including the parity tests.
- [ ] Definition of done in `AGENTS.md` §9.

## Out of scope
- Pydantic models for other contracts (added by the service task that serves them).
- Generating Pydantic code from JSON Schema; OpenAPI export.
- The pagination envelope (NOVA-045): do not add a `Page` schema here.

## Questions
_(implementer writes here if blocked)_

## Handoff
_(implementer, ≤ 20 lines — see `docs/templates/HANDOFF.md`)_

## Review
_(Claude, ≤ 20 lines — see `docs/templates/REVIEW.md`)_
