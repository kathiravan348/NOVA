# NOVA-037 — Backtest result: per-symbol breakdown + trade symbol filter

**Status:** done · **Owner:** Claude · **Branch:** main · **Depends on:** NOVA-031

## Goal
A completed run shows results per symbol (trades, win rate, net P&L) and the trades table can be
filtered by symbol (R2). The breakdown comes from the backend (`BacktestResult.bySymbol`), like D26.

## Files
Modify: contracts `src/backtest.ts` (+ test: `SymbolBreakdownSchema`, `bySymbol`); mocks
`data/backtestResults.json`, `src/orbit.consistency.test.ts`; Orbit `pages/backtests/{BacktestResultPage.tsx,
TradesTable.tsx,backtests.test.tsx}`; `docs/CONTRACTS.md`.
Create: Orbit `pages/backtests/SymbolBreakdown.tsx`.

## Acceptance checks
- [x] `bySymbol`: one row per traded symbol; wins + losses ≤ trades; consistency test recomputes it from
      trades and checks the rows add up to the run's net P&L.
- [x] "Results by symbol" table with "Show trades" per row; trades get a "Symbol" filter (All symbols default).

## Out of scope
- Per-symbol equity curves, charges per symbol.

## Handoff
**Done:** Built by Claude directly on `main` (Gemini offline; Owner request 2026-09-23).
**Checked:** contracts, mocks, Orbit backtests tests pass; typecheck and lint pass.

## Review
**Result:** done (self-built; no separate review).
