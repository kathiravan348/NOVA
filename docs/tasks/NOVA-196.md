# NOVA-196 — Orbit: Experiment page (matrix, results, final lock) (D84)

**Status:** planned · **Owner:** — · **Branch:** task/NOVA-196 · **Depends on:** NOVA-192, NOVA-193, NOVA-195

## Goal
Orbit gets **Experiments**: create an experiment (profile version, variants, universe), freeze it, run each block,
and read the 5 × 3 matrix of results (base and stress side by side) with each run's intraday report, then record
the shortlist, pass thresholds and each variant's outcome. Final-block results open only through **Reveal**.

## Read first
- `AGENTS.md` §6, §7a; `docs/INTRADAY-RESEARCH.md` §8, §11; `docs/tasks/NOVA-192.md`, `NOVA-193.md` (contracts, errors)
- `frontend/apps/nova-orbit/src/routes.tsx`, `layout/AppLayout.tsx`, `pages/backtests/BacktestResultPage.tsx`, `MetricsGrid.tsx`

## Files
Create:
- `frontend/apps/nova-orbit/src/pages/experiments/ExperimentsPage.tsx`, `ExperimentPage.tsx`, `NewExperimentDialog.tsx`,
  `ExperimentMatrix.tsx`, `BlockCard.tsx`, `ShortlistDialog.tsx`, `OutcomeSelect.tsx`, `experiments.test.tsx`
- `frontend/apps/nova-orbit/src/pages/backtests/IntradayReportCard.tsx` (shared with the run page)
Modify:
- `frontend/apps/nova-orbit/src/routes.tsx`, `layout/AppLayout.tsx`, `routes.test.tsx`
- `frontend/apps/nova-orbit/src/pages/backtests/BacktestResultPage.tsx` (intraday runs show the report card + history inputs)
- `docs/guides/USER-GUIDE.md` (new section "Experiments")

## Build
1. Menu **Experiments** after **Research plan**; routes `/experiments`, `/experiments/:id`.
2. New experiment: name, frozen profile version, strategies (intraday versions only, labelled V01…), universe
   (NIFTY 100 preset, editable), capital ₹10,00,000, 20 + 20 sessions. Draft can change; **Freeze** confirms first.
3. Experiment page: three **block cards** (Development / Validation / Final) with dates, usable sessions, status
   and **Run block** (disabled with the server's reason, e.g. "Only 7 of 20 sessions recorded yet"). The
   **matrix**: rows = setups, columns = buying rules, each cell base | stress net P&L, positions, expectancy R,
   skipped; a cell opens the run. Zero-trade cells show 0, not empty.
4. **Shortlist and thresholds** dialog (once, before the final block). Final cells show **Reveal** (confirm: "This
   view is recorded"); after reveal they show numbers. Each variant row has an **Outcome** select + note.
5. `IntradayReportCard`: positions, net, expectancy (₹ and R), win rate, profit factor, worst day, drawdown,
   unresolved, skip reasons (first-reason bars), R distribution, "small sample" warning, history inputs; base vs
   stress when the pair exists. Numbers mono, right-aligned, Indian grouping.

## Acceptance checks
- [ ] Tests on mocks: create + freeze; run a block; matrix values match the mock runs; disabled reasons shown;
      shortlist once; reveal confirms then shows; outcome saved; run page shows the report card for intraday runs.
- [ ] 360px (matrix becomes stacked cards) and desktop, dark and light; `pnpm review:check` passes.

## Out of scope
- Backend (192, 193); automatic winner selection; charts beyond the simple bars.

## Questions
_(implementer writes here if blocked)_

## Handoff
_(implementer, ≤ 20 lines — see `docs/templates/HANDOFF.md`)_

## Review
_(reviewer — Claude or ChatGPT, ≤ 20 lines — see `docs/templates/REVIEW.md`)_
