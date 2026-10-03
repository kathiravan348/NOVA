# NOVA-192 — Intraday report: skip reasons, R, expectancy, unresolved, base vs stress (D84)

**Status:** planned · **Owner:** — · **Branch:** task/NOVA-192 · **Depends on:** NOVA-186

## Goal
`GET /backtests/{id}/intraday-report` returns the measures of `docs/INTRADAY-RESEARCH.md` §11 for an intraday run,
computed from its trades, `intraday_trades`, `intraday_decisions` and equity, with contracts, mocks and a hook, so
the Orbit pages (NOVA-196) can show them.

## Read first
- `AGENTS.md` §7, §7a, §8; `docs/INTRADAY-RESEARCH.md` §5.4 (reason names), §11; guide chapter 21
- `backend/services/backtest/src/nova_backtest/routes.py`, `metrics.py`; `frontend/packages/services/src/api/orbit.ts`

## Files
Create:
- `backend/libs/nova_contracts/src/nova_contracts/intraday_report.py`, `backend/libs/nova_contracts/tests/test_intraday_report.py`
- `backend/services/backtest/src/nova_backtest/intraday/report.py`, `backend/services/backtest/tests/test_intraday_report.py`
- `frontend/packages/contracts/src/intradayReport.ts`, `intradayReport.test.ts`; `frontend/packages/mocks/data/intradayReports.json`
Modify:
- `backend/libs/nova_contracts/src/nova_contracts/__init__.py`; `backend/services/backtest/src/nova_backtest/routes.py`, `tests/test_api.py`
- `frontend/packages/contracts/src/index.ts`, `jsonSchema.test.ts`, `schema/*.json`; `frontend/packages/mocks/src/data.ts`,
  `schemas.test.ts`, `src/handlers/orbit.ts`, `orbit.test.ts`; `frontend/packages/services/src/api/orbit.ts`, `queries/orbit.ts`, `queries.test.tsx`
- `docs/CONTRACTS.md`, `docs/guides/API.md`

## Build
1. `IntradayReport`: `sessions` {usable, withTrades, zeroTrade, skippedDays}, `positions`, `wins`, `losses`,
   `netPnlPaise`, `expectancyPaise`, `expectancyR` (net ÷ original money risk), `winRatePercent`, `profitFactor`
   (null without losses), `maxDrawdownPercent`, `worstDayPaise`, `largestLossPaise`, `unresolved` (count + value),
   `incomplete`, `rDistribution` (buckets ≤ −2, −2…−1, −1…0, 0…1, 1…2, ≥ 2), `skipReasons` [{reason,
   firstCount, anyCount}], `decisions` {candidates, filled, partial, skipped}, `peakCapitalPercent`,
   `peakOpenRiskPercent`, `historyInputs`, `smallSample` (true below 60 sessions or 30 positions).
2. `adds` (non-`single` runs): adds tried / filled / rejected with reasons; `matchedSingleRunId` (same strategy
   setup + `single`, same profile version, scenario and period) and the net P&L / drawdown difference, else null.
3. `GET /backtests/{id}/intraday-report`: 404 unknown run, 400 `Not an intraday run`, 409 while not completed.
   Computed on read (no migration); `GET /backtests/{id}/intraday-report?compare={otherId}` adds a `stress`
   block (the other run's net, expectancy, skips) for base vs stress (400 if the pair differs in more than scenario).
4. Mocks: one report for the mock intraday run (numbers consistent: net = sum of trades); handler + hook
   `useIntradayReport(id, compareId?)`.

## Acceptance checks
- [ ] Report tests on a seeded run: every number by hand; zero-trade run → zeros, nulls where undefined, no error.
- [ ] Skip reasons: `firstCount` sums to skipped candidates; `anyCount` ≥ `firstCount`.
- [ ] Compare: base vs stress pair works; a pair with a different profile → 400. API errors as listed.
- [ ] Parity, schema and handler tests; `pnpm review:check` and `docker compose run --rm backend-check` pass.

## Out of scope
- Screens (196); experiment-level tables (193); annualised ratios.
- Deploy: `backtest` with `--no-deps` (no migration).

## Questions
_(implementer writes here if blocked)_

## Handoff
_(implementer, ≤ 20 lines — see `docs/templates/HANDOFF.md`)_

## Review
_(reviewer — Claude or ChatGPT, ≤ 20 lines — see `docs/templates/REVIEW.md`)_
