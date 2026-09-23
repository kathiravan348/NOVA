# NOVA-032 — StrategyStats contract, mock, handler, service

**Status:** done · **Owner:** Claude · **Branch:** main · **Depends on:** NOVA-031

## Goal
The backend summary behind the strategy cards (R1, D26): per strategy, run counts by status, last run,
best/worst return, win-rate range, worst drawdown and best net P&L with its run. Screens never aggregate.

## Files
Create: contracts `src/strategyStats.ts` (+ test); mocks `data/strategyStats.json`.
Modify: contracts `src/index.ts`; mocks `src/data.ts`, `src/handlers/{orbit.ts,orbit.test.ts,scenarios.ts}`,
`src/orbit.consistency.test.ts`; services `src/api/{orbit.ts,api.test.ts}`,
`src/queries/{orbit.ts,keys.ts,queries.test.tsx}`; `docs/CONTRACTS.md`.

## Acceptance checks
- [x] Schema refines: total = completed + failed + in progress; result stats null exactly when nothing completed;
      worst ≤ best; win-rate min ≤ max; drawdown ≤ 0.
- [x] `GET /strategies/stats` is matched before `/strategies/:id`; empty and error scenarios cover it.
- [x] Consistency test recomputes every mock value from runs and results.
- [x] `listStrategyStats` + `useStrategyStats` tested.

## Out of scope
- Cards and detail stats UI (NOVA-034).

## Handoff
**Done:** Built by Claude directly on `main` (Gemini offline; Owner request 2026-09-23).
**Checked:** contracts, mocks, services tests pass (272); typecheck and lint pass.

## Review
**Result:** done (self-built; no separate review).
