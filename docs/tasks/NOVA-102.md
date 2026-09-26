# NOVA-102 — Orbit: live backtest progress on the run page and in the list

**Status:** planned · **Owner:** — · **Branch:** task/NOVA-102 · **Depends on:** NOVA-101

## Goal
A queued or running backtest shows live progress (D58): a progress bar, what it is doing in plain words,
time running and time left. The run list shows the percent. The page switches to results when it completes.

## Read first
- `AGENTS.md`; `docs/DECISIONS.md` D58; `frontend/packages/contracts/src/backtest.ts` (`BacktestProgress`)
- `frontend/packages/services/src/queries/orbit.ts` (`useBacktest`, `useBacktests`); `queries/relay.ts` (a `refetchInterval` example)
- `frontend/apps/nova-orbit/src/pages/backtests/{BacktestResultPage,runColumns,backtests.test}.tsx`
- `frontend/packages/ui-trading/src/components/Meter/Meter.tsx`; `frontend/apps/nova-relay/src/pages/data-jobs/DataJobDetailPage.tsx` (Meter use)

## Files
Create:
- `frontend/apps/nova-orbit/src/pages/backtests/RunProgress.tsx`, `runProgress.ts`, `runProgress.test.ts`
Modify:
- `frontend/packages/services/src/queries/orbit.ts`, `queries/queries.test.tsx`
- `frontend/apps/nova-orbit/src/pages/backtests/{BacktestResultPage,runColumns,backtests.test}.tsx`
- `docs/guides/USER-GUIDE.md` (Step 5–6: watching a run, the "what do I do if" table)

## Build
1. `useBacktest`: `refetchInterval` 2 s while `queued`/`running`, off otherwise. `useBacktests`: 5 s while any
   loaded run is `queued`/`running`. When a run turns `completed`, invalidate its list and strategy stats queries.
2. `runProgress.ts` (pure, tested): `progressLine(p)` →
   `loading`: "Loading prices — 12 of 50 stocks"; `signals`: "Running your Python code";
   `simulating`: "Simulating — reached 14 Mar 2025 · 37 trades so far"; `saving`: "Saving 412 trades";
   `timeLeft(startedAt, percent, now)` → null until ≥ 5% and ≥ 10 s, else "About 3 min left" (elapsed × (100 − p) / p).
   Numbers use the existing Indian grouping formatters.
3. `RunProgress.tsx`: for `running`, a Card with `Meter` (label "Progress", percent), the progress line,
   "Running for 2 min 10 s" and the time left; for `queued`, the current waiting message. Replaces the hourglass
   empty state in `BacktestResultPage`. A `failed` run with progress adds "Stopped while: <progress line> (62%)" under the error.
4. `runColumns`: the status cell of a running run reads "Running · 42%".
5. Works at 360px (the Card stacks) and in both themes.

## Acceptance checks
- [ ] Vitest: each stage's line; time left null below 5%; "Running · 42%" in the list; a running run page shows
      the Meter and line, then shows results after the mocked run turns `completed`.
- [ ] Owner stack: a NIFTY 50 5m backtest shows the stages moving and ends on the results.
- [ ] Definition of done in `AGENTS.md` §9.

## Out of scope
- Backend changes. WebSocket updates for runs. A Cancel button. A ui-core/ui-trading component (use `Meter`).

## Questions

## Handoff

## Review
