# NOVA-121 — Strategy library: 60 strategies as data, list + install endpoints (D62 (7))

**Status:** planned · **Owner:** — · **Branch:** task/NOVA-121 · **Depends on:** NOVA-112, NOVA-114, NOVA-127

## Goal
The strategy service ships the 60 strategies of `docs/STRATEGY-LIBRARY.md` as validated data. `GET /strategies/library`
lists them, and `POST /strategies/library/install` adds chosen ones as draft strategies. Services and mocks are ready for the
Library page (NOVA-122).

## Read first
- `AGENTS.md`; `docs/DECISIONS.md` D43, D47, D62; **`docs/STRATEGY-LIBRARY.md` (the source of truth)**; every file under Files

## Files
Create:
- `backend/services/strategy/src/nova_strategy/library/{families,a_rotation,b_trend,c_pullback,d_patterns,ef_hold_baseline,g_intraday}.json`
- `backend/services/strategy/src/nova_strategy/library.py`, `backend/services/strategy/tests/test_library.py`
- `backend/services/backtest/tests/test_library_code.py` (reads the D JSON by relative path, runs `check_code`)
- `backend/libs/nova_contracts/src/nova_contracts/library.py`; `frontend/packages/contracts/src/library.ts` (+ `.test.ts`)
- `frontend/packages/mocks/data/strategyLibrary.json`
Modify:
- `backend/services/strategy/src/nova_strategy/routes.py`, `backend/libs/nova_contracts/src/nova_contracts/__init__.py`
- `frontend/packages/contracts/src/index.ts`, `schema/*.json` (`schema:update`)
- `frontend/packages/services/src/{api,queries}/orbit.ts`, `frontend/packages/services/src/api/api.test.ts`
- `frontend/packages/mocks/src/handlers/{orbit,orbit.test}.ts`, `frontend/packages/mocks/src/schemas.test.ts`
- `docs/guides/API.md`, `docs/CONTRACTS.md`

## Build
1. Contracts (both sides, with parity):
   - `LibraryFamily {id, name, idea, watch}`
   - `LibraryEntry {id ("A01"…"G10"), family, name, summary, spec: StrategySpec, backtest: {universe, from, to, initialCapitalPaise, benchmark}}`
   - `StrategyLibrary {families, entries}`
   - `LibraryInstall {ids: string[] 1–100, unique}`
2. JSON data: transcribe the doc exactly, following its §1–2 defaults and notation:
   - every indicator setting is written out
   - Python code is copied character for character
   - `summary` is one plain sentence per strategy (write it from the doc's name and rules; ≤ 140 characters)
   - families use the doc's Idea/Watch lines
   - `backtest` follows §2
3. `library.py` loads and validates the files once (Pydantic + `spec_param_problems`). It fails loudly at start-up if any
   file is invalid.
4. `GET /strategies/library` → `StrategyLibrary`.
5. `POST /strategies/library/install`:
   - For each id, in order, create a `draft` strategy (name = entry name, description = summary, version 1, note
     "From the library ({id})").
   - Write one `strategy.create` audit per strategy.
   - Everything happens in one transaction. An unknown id → 400 naming it.
   - Answers 201 `Strategy[]`.
6. Services `getStrategyLibrary`, `installLibrary(ids)` + hooks (install invalidates strategies and stats). Mocks: 7 entries
   (one per family) and stateless handlers.

## Acceptance checks
- [ ] `test_library.py`:
  - 60 entries, unique ids and names
  - A–F are `equity_delivery` 1d; G is `equity_intraday` 15m
  - every family is known; counts A12 B14 C14 D6 E2 F2 G10
  - every spec validates with no param problems
  - 5 spot-checked entries (A04, B03, C11, D05, G07) equal hand-written expected specs
- [ ] `test_library_code.py`: all 6 Python strategies pass `check_code` and run on 300 synthetic bars.
- [ ] Install test: 3 ids create 3 drafts plus 3 audit rows; an unknown id changes nothing.
- [ ] `backend-check` and `pnpm review:check` pass. API guide rows added; "State as of" updated.

## Out of scope
- The Library page (NOVA-122); running backtests; editing library entries (they are fixed data; changing one is a task).

## Questions
_(implementer writes here if blocked)_

## Handoff
_(implementer, ≤ 20 lines — see `docs/templates/HANDOFF.md`)_

## Review
_(Claude, ≤ 20 lines — see `docs/templates/REVIEW.md`)_
