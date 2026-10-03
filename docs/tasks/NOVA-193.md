# NOVA-193 — Experiments: frozen plan, blocks, final-block lock, trial register (D84, migration 0035)

**Status:** planned · **Owner:** — · **Branch:** task/NOVA-193 · **Depends on:** NOVA-184, NOVA-185, NOVA-192 (shares `routes.py` and mock/service lists)

## Goal
An **experiment** (`docs/INTRADAY-RESEARCH.md` §8) freezes a profile version, strategy versions (variants V01…), a
universe and three date blocks, and queues every variant × `base`/`stress` run of a block in one action. Final
runs need a shortlist + thresholds first; each view is logged; experiment runs cannot be deleted.

## Read first
- `AGENTS.md` §7, §7a, §8; `docs/DECISIONS.md` D60, D67, D84; `docs/INTRADAY-RESEARCH.md` §7, §8
- `backend/services/backtest/src/nova_backtest/routes.py` (`queue_run`, deletes), `profiles.py`; `tick_bars.py` (`usable_days`)

## Files
Create:
- `backend/libs/nova_db/src/nova_db/migrations/versions/rev0035_experiments.py`
- `backend/libs/nova_contracts/src/nova_contracts/experiment.py`, `backend/libs/nova_contracts/tests/test_experiment.py`
- `backend/services/backtest/src/nova_backtest/experiments.py`, `backend/services/backtest/tests/test_experiments.py`
- `frontend/packages/contracts/src/experiment.ts`, `experiment.test.ts`; `frontend/packages/mocks/data/experiments.json`,
  `src/handlers/experiments.ts`, `experiments.test.ts`; `frontend/packages/services/src/api/experiments.ts`, `queries/experiments.ts`
Modify:
- `backend/libs/nova_db/src/nova_db/models/backtest.py`, `models/__init__.py`, `tests/test_migrations.py`
- `backend/services/backtest/src/nova_backtest/main.py`, `routes.py` (refuse deleting experiment runs), `tests/test_api.py`
- `backend/services/core/src/nova_core/gateway.py`, `agent_rules.py` (`experiments`: held), `tests/test_agent_rules.py`
- `backend/libs/nova_contracts/src/nova_contracts/__init__.py`; `frontend/packages/contracts/src/index.ts`, `jsonSchema.test.ts`,
  `schema/*.json`; `frontend/packages/mocks/src/data.ts`, `schemas.test.ts`, `src/handlers/index.ts`;
  `frontend/packages/services/src/index.ts`, `src/queries/keys.ts`, `src/queries/queries.test.tsx`
- `docs/CONTRACTS.md`, `docs/guides/API.md`, `docs/guides/DATABASE.md`

## Build
1. Tables: `experiments` (id, name, `status` draft|frozen, profile id+version, `universe` text[], `capital_paise`,
   `validation_sessions` 20, `final_sessions` 20, `shortlist` text[], `thresholds` text, `hash`, created/frozen at),
   `experiment_variants` (experiment, `label` V01…, strategy id + version, `outcome` null|reject|inconclusive|revise|
   continue, `outcome_note`), `experiment_views` (experiment, at, user). Runs: FK `experiment_id`, `experiment_block`
   (`development`|`validation`|`final`).
2. Endpoints: `GET/POST /experiments`, `GET /experiments/{id}`, `PUT` (draft only), `POST …/freeze` (profile version
   must be frozen, every strategy version intraday; hash of the plan), `POST …/blocks/{block}/run` (queues variants ×
   2 scenarios, `recorded`, NOVA-185 checks), `PUT …/shortlist` {labels, thresholds} (frozen only, once, before the
   final block), `PUT …/variants/{label}/outcome`. Block dates: development = 1 Oct 2026 → freeze day; validation =
   the next `validation_sessions` usable sessions after the freeze; final = the next `final_sessions` after those
   (400 "Only N of 20 sessions recorded yet" until they exist; final also needs the shortlist).
3. Final-block runs: list/result/trades/report of a final run need `?reveal=true`; each reveal adds an
   `experiment_views` row. Deleting any experiment run → 400 `Part of experiment …`. All writes audited
   (`settings.update`, target `settings` / `experiment/<id>`).
4. Mocks: one frozen experiment (5 variants × base/stress, development runs done, validation waiting).

## Acceptance checks
- [ ] Freeze rules (draft profile, non-intraday → 400); stable hash; a block queues 2 × variants runs; blocks
      refused until enough sessions / the shortlist; reveal logged; runs undeletable; all test suites pass.

## Out of scope
- The Orbit page (196). Automatic scoring or ranking. Deploy after 15:45 IST / weekend: migrate 0035, then
  `backtest backtest-worker core` with `--no-deps`.

## Questions
_(implementer writes here if blocked)_

## Handoff
_(implementer, ≤ 20 lines — see `docs/templates/HANDOFF.md`)_

## Review
_(reviewer — Claude or ChatGPT, ≤ 20 lines — see `docs/templates/REVIEW.md`)_
