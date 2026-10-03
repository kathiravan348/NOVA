# NOVA-182 — Contracts: research profile (D84)

**Status:** in-progress · **Owner:** ChatGPT · **Branch:** task/NOVA-182 · **Depends on:** —

## Goal
The research profile (shared intraday settings, `docs/INTRADAY-RESEARCH.md` §2) exists as Zod + Pydantic contracts
with mocks, handlers and hooks, so the backend (NOVA-184) and the Orbit page (NOVA-194) share one shape.

## Read first
- `AGENTS.md` §7, §8; `docs/DECISIONS.md` D34, D84; `docs/INTRADAY-RESEARCH.md` §2 (every field, default, rule)
- `frontend/packages/contracts/src/recorder.ts` + `backend/libs/nova_contracts/src/nova_contracts/recorder.py` (style, parity test)

## Files
Create:
- `backend/libs/nova_contracts/src/nova_contracts/research_profile.py`, `backend/libs/nova_contracts/tests/test_research_profile.py`
- `frontend/packages/contracts/src/researchProfile.ts`, `researchProfile.test.ts`
- `frontend/packages/mocks/data/researchProfiles.json`, `src/handlers/researchProfiles.ts`, `src/handlers/researchProfiles.test.ts`
- `frontend/packages/services/src/api/research.ts`, `src/queries/research.ts`
Modify:
- `backend/libs/nova_contracts/src/nova_contracts/__init__.py`, `frontend/packages/contracts/src/index.ts`, `jsonSchema.test.ts`, `schema/*.json` (run `schema:update`)
- `frontend/packages/mocks/src/data.ts`, `schemas.test.ts`, `src/handlers/index.ts`; `frontend/packages/services/src/index.ts`, `src/queries/keys.ts`, `queries.test.tsx`
- `docs/CONTRACTS.md`

## Build
1. `ResearchSettings` = six strict groups `account`, `execution`, `market`, `signal`, `timing`, `data` with exactly the
   §2 field names. Ranges: percents `> 0` and `≤ 100` (`addPoolPercent`, `reservePercent` may be 0); risk percents
   `≤ 5`, `openRiskPercent`/`dailyLossPercent` `≤ 10`; `maxPositions` 1–20; `maxNewPositionsPerDay` 1–50;
   `lossStreakPause` 0–10 (0 = off); ms 0–10,000 (`maxQuoteAgeMs` 100–60,000); ticks 0–20; `maxSpreadBps` ≤ 200;
   `volumeBaselineSessions` 5–60; `atrPeriod` 2–50; `contextEmaPeriod` 2–100; ATR multiples `> 0` and `≤ 20`;
   times `HH:MM` IST inside 09:15–15:29; `maxHoldMinutes` 1–375; `maxSessionGapSeconds` 0–300; `marketIndex` = `IndexName`.
2. Cross-field rules (Zod `superRefine` and Pydantic `model_validator`, same messages): pools sum ≤ 100;
   `openRiskPercent ≥ riskPerPositionPercent`; stress delay/ticks ≥ base; `maxStopAtr > minStopAtr`;
   `earliestEntry < lastEntry < squareOff`.
3. `DEFAULT_RESEARCH_SETTINGS` (TS) / `default_research_settings()` (Py) = the §2 defaults; a test checks they are equal.
4. `ResearchProfileVersion {version ≥ 1, note, settings, frozen, hash (64 hex) | null, createdAt, frozenAt | null}`
   (hash null exactly when not frozen). `ResearchProfile {id, name, description, versions (newest first),
   createdAt, updatedAt}`. Bodies: `ResearchProfileCreate {name, description, settings}`,
   `ResearchProfileVersionCreate {note, settings}`, `ResearchProfileVersionUpdate {settings}`.
5. Endpoints (mock now, backend in NOVA-184): `GET /research-profiles` (list), `POST /research-profiles`,
   `GET /research-profiles/{id}`, `POST /research-profiles/{id}/versions` (new draft),
   `PUT /research-profiles/{id}/versions/{version}` (draft only, 400 `Frozen versions cannot change`),
   `POST /research-profiles/{id}/versions/{version}/freeze` (400 if already frozen). 404 for unknown ids.
6. Mocks: one profile "Intraday v1" with a frozen v1 (defaults, fixed hash) and a draft v2 (`maxSpreadBps` 6);
   handlers keep changes in memory like other mock writes. Services: list/get/create/addVersion/updateVersion/
   freeze functions + TanStack hooks under `queryKeys.research`.

## Acceptance checks
- [x] Schema tests: defaults valid; each cross-field rule rejects a bad value with its message; strict objects reject extra keys.
- [x] Parity test: Pydantic dumps of every model validate against the generated JSON Schema.
- [ ] Handler tests: create, add version, update draft, update frozen → 400, freeze, freeze twice → 400, 404.
      `pnpm review:check` and `docker compose run --rm backend-check` pass.

## Out of scope
- Database, backend endpoints, gateway routing (NOVA-184); any screen (NOVA-194); the intraday strategy spec (NOVA-183).

## Questions
_(implementer writes here if blocked)_

## Handoff
**Done:** Six research setting groups, parity/defaults, version bodies, stateful mock endpoints and query hooks.
**Files changed:** `backend/libs/nova_contracts/{src/nova_contracts,tests}/` research models, exports and parity test.
`frontend/packages/contracts/{src,schema}/` research contracts, tests, exports and six generated schemas.
`frontend/packages/mocks/{data,src}/` research fixtures, handlers, registration and schema tests.
`frontend/packages/services/src/{api,queries}/` research functions/hooks, keys, tests and root exports.
`docs/CONTRACTS.md`, `docs/tasks/{BOARD,NOVA-182}.md`.
**Commands run:** `pnpm review:check` passes (Vitest max 4/min 1 workers, 1,241 tests); ruff/mypy/parity (53 tests) pass; Docker gate pending.
**Checked:** 360px / desktop / dark / light: N/A (no screens).
**New dependencies:** none.
**Maps updated:** CONTRACTS.
**Guides:** none (mock contracts only; real API comes in NOVA-184).
**Deviations from task:** none; demo freeze uses a fixed hash, canonical backend hashing is NOVA-184.
**Known gaps:** none.

## Review
_(reviewer — Claude or ChatGPT, ≤ 20 lines — see `docs/templates/REVIEW.md`)_
