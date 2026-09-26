# NOVA-089 — Orbit: index choices from the indices list

**Status:** done · **Owner:** Claude · **Branch:** task/NOVA-089 · **Depends on:** NOVA-085

## Goal
Orbit's backtest universe picker and market-data filter offer every index in `market_indices`, not the
old fixed three (D56 (3)).

## Read first
- `AGENTS.md`, `docs/DECISIONS.md` D56
- `frontend/apps/nova-orbit/src/pages/backtests/{UniverseFields.tsx,backtestForm.ts}`
- `frontend/apps/nova-orbit/src/components/InstrumentTable.tsx`
- `frontend/packages/services/src/{api,queries}/marketData.ts`

## Files
Modify:
- `frontend/apps/nova-orbit/src/pages/backtests/{UniverseFields.tsx,backtestForm.ts}` + their test
- `frontend/apps/nova-orbit/src/components/InstrumentTable.tsx`, `frontend/apps/nova-orbit/src/pages/market-data/marketData.test.tsx`
- `frontend/packages/services/src/api/marketData.ts`, `queries/marketData.ts` (only `useMarketIndices`, if 088 has not merged it yet — coordinate: whichever merges second rebases)
- `frontend/packages/contracts/src/strategy.ts` (remove `DEFAULT_INDEX_NAMES` once unused)
- `docs/guides/USER-GUIDE.md`

## Build
1. Options come from `useMarketIndices()` (loading → disabled select, error → message with Retry).
2. `backtestForm.ts` validates `index` as a non-empty string; the server checks it exists.
3. An old strategy/backtest naming an index no longer in the list still displays its name.

## Acceptance checks
- [ ] Vitest: options render from the mocked 19 indices; loading and error states.
- [ ] 360px + desktop, dark + light.
- [ ] Definition of done in `AGENTS.md` §9.

## Out of scope
- Relay (088). Index price charts or downloads.

## Questions

## Handoff
Built by Claude at the Owner's request. All acceptance checks pass.
- Backtest form: **Index** options from `useMarketIndices()` with member counts; keeps a name the list no
  longer has; disabled while loading, error text if it fails.
- Market data `InstrumentTable`: index filter lists the indices its instruments belong to (like sectors),
  so no extra request. `DEFAULT_INDEX_NAMES` removed from contracts.
- Also touched: backtest engine error for an empty index no longer names the removed CLI command.
- Checks: `pnpm review:check` green; backtest pytest green. Guides: USER-GUIDE.

## Review
Self-reviewed.
