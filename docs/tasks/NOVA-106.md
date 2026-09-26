# NOVA-106 — Strategy stats per strategy version (D60)

**Status:** done · **Owner:** Claude · **Branch:** task/NOVA-106 · **Depends on:** NOVA-104

## Goal
`GET /strategies/stats` also returns `byVersion`: each strategy version's completed runs and best return, so
Orbit can show them next to each version's rules.

## Read first
- `AGENTS.md`; `docs/DECISIONS.md` D60; `docs/CONTRACTS.md` (StrategyStats)
- `backend/services/strategy/src/nova_strategy/stats.py` and the test file that covers it

## Files
Modify:
- `backend/services/strategy/src/nova_strategy/stats.py`, its test file under `backend/services/strategy/tests/`
- `docs/guides/API.md` (`/strategies/stats`)

## Build
1. A second SQL query: every `strategy_versions` row LEFT JOIN its completed runs + results, grouped by
   (strategy, version): count of completed runs, `max(return_percent)`, and the run id with the best return
   (ties: lowest run id). Versions with no completed run: 0 and nulls.
2. `strategy_stats` attaches `by_version` (ascending version) to each strategy's stats. Runs of every backtest
   version count (slim ones keep their metrics).
3. API.md: describe `byVersion`.

## Acceptance checks
- [ ] pytest: a strategy with v1 (two completed runs, returns 2% and 5%) and v2 (none) →
      `[{1, 2, 5.0, <run>}, {2, 0, null, null}]`; parity with the contract.
- [ ] Definition of done in `AGENTS.md` §9.

## Out of scope
- Frontend (108). Changing the existing stats fields.

## Questions

## Handoff
Done. `stats.py` second query `_BY_VERSION` (every strategy version, completed runs, best return, best run id with
ties on lowest id); `by_version` attached per strategy. Test for v1 (two runs) / v2 (none). API.md.
Guides: API.

## Review
Built and reviewed by Claude. `backend-check` 698 passed; `pnpm review:check` passed. Merged.
