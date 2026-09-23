# NOVA-034 — StrategyCard + Orbit strategies card grid + detail stats and Backtests tab

**Status:** done · **Owner:** Claude · **Branch:** main · **Depends on:** NOVA-032

## Goal
The strategies list is a card grid (R1) fed by `StrategyStats`: facts, run counts, best/worst return,
win-rate range, worst drawdown, best net P&L linking to its run; filter by status, sort by updated /
best return / runs. Strategy detail shows the same stats and a Backtests tab.

## Files
Create: ui-trading `components/StrategyCard/{StrategyCard.tsx,StrategyStatsList.tsx,StrategyCard.stories.tsx,
StrategyCard.test.tsx}`; Orbit `pages/backtests/runColumns.tsx`.
Modify: ui-trading `src/index.ts`; Orbit `pages/strategies/{StrategiesPage.tsx,StrategyDetailPage.tsx,
strategies.test.tsx}`, `pages/backtests/BacktestsPage.tsx` (uses shared columns); `docs/COMPONENTS.md`.

## Acceptance checks
- [x] Stories: Default, NoCompletedRuns, Loading, StatsUnavailable.
- [x] Cards show stats from `/strategies/stats` only (no aggregation in the screen).
- [x] Status filter and sort (updated / best return / most runs) work; no-match empty state.
- [x] Detail: "Backtest stats" card and a Backtests tab listing only that strategy's runs.

## Out of scope
- Stats endpoints per strategy, server-side sorting.

## Handoff
**Done:** Built by Claude directly on `main` (Gemini offline; Owner request 2026-09-23).
**Checked:** Orbit + ui-trading tests pass (108); typecheck and lint (incl. token class check) pass.

## Review
**Result:** done (self-built; no separate review).
