# NOVA-121 — Strategy library: 60 strategies as data, list + install endpoints (D62 (7))

**Status:** done · **Owner:** Claude · **Branch:** task/NOVA-121 · **Depends on:** NOVA-112, NOVA-114, NOVA-127

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
Done. Contracts both sides: `LibraryFamily`, `LibraryBacktest` (period + universe, capital, benchmark), `LibraryEntry`
(id `^[A-G][0-9]{2}$`, family enum, summary ≤ 140, spec, backtest), `StrategyLibrary`, `LibraryInstall` (1–100 unique
ids); schemas regenerated. Data: `nova_strategy/library/*.json` (7 families, 60 entries: A12 B14 C14 D6 E2 F2 G10),
produced by a one-off script that parses `docs/STRATEGY-LIBRARY.md` itself (tables, `[n]`, `×`, SL/TP/TRAIL/ATR/HOLD,
averaging, sizing, rank; D code blocks verbatim) and validates every entry; summaries written per entry. `library.py`
loads and checks everything once (`lru_cache`); `create_app` calls it so a bad file stops start-up. Routes
`GET /strategies/library`, `POST /strategies/library/install` (drafts in order, note "From the library (A01)", one
`strategy.create` audit each, one commit; unknown id → 400 naming it); `create_strategy` now shares `_create`.
Services `getStrategyLibrary` / `installLibrary`, hooks `useStrategyLibrary` (own key, never stale) /
`useInstallLibrary` (refreshes strategies and stats). Mocks: `strategyLibrary.json` (A01, B01, C11, D02, E01, F01, G01 +
7 families), stateless handlers.
- Tests: `test_library.py` (counts, families, segments/timeframes, param checks, A04/B03/C11/G07 equal hand-written
  specs, D05 name/risk/code ends; GET parity; install 3 → 3 drafts + 3 audits; unknown / duplicate / malformed ids add
  nothing); `test_library_code.py` (6 codes pass `check_code` and run on 300 bars); contract, handler, schema, API tests.
- Families E/F have no Watch line in the doc; written from its §7/§9 wording.
Commands: backend-check 1019 passed; `pnpm review:check` passed. Guides: API (2 rows), CONTRACTS.

## Review
Built and reviewed by Claude. Acceptance checks pass. Merged.
