# NOVA-170 — Backtests list: results, filters and sorting; strategy stats by source (D82)

**Status:** planned · **Owner:** — · **Branch:** task/NOVA-170 · **Depends on:** NOVA-166

## Goal
`GET /backtests` returns each run's key results, segment and timeframe, and filters and sorts on them on the
server; `GET /strategies/stats` can count one data source only. Services and mocks follow.

## Read first
- `AGENTS.md`; `docs/DECISIONS.md` rows D60, D74 (5), D82 (6), (10)
- `nova_backtest/{routes,convert}.py`; `nova_db/paging.py`; `nova_strategy/{routes,stats}.py`
- `frontend/packages/services/src/{api,queries}/orbit.ts`

## Files
Modify:
- `backend/libs/nova_contracts/src/nova_contracts/backtest.py` (+ `__init__.py` export lines), parity test
- `backend/services/backtest/src/nova_backtest/{routes,convert}.py`, test `test_api.py`
- `backend/services/strategy/src/nova_strategy/{routes,stats}.py`, test `test_stats.py`
- `frontend/packages/contracts/src/backtest.ts` (+ test), generated `schema/*.json`
- `frontend/packages/services/src/{api,queries}/orbit.ts`, `queries/keys.ts`, `queries/queries.test.tsx`
- `frontend/packages/mocks/src/handlers/orbit.ts` (+ test): the same filters and sorts on mock runs
- `docs/guides/API.md`, `docs/CONTRACTS.md`

## Build
1. Contract `BacktestRunSummary`: `netPnlPaise`, `returnPercent`, `cagrPercent`, `maxDrawdownPercent`,
   `winRatePercent`, `tradeCount`, `profitFactor | null`, `sharpe`, `afterTaxCagrPercent | null`, `spreadCostPaise | null`.
   `BacktestRunListItem` = `BacktestRun` + `segment`, `timeframe` (the run's strategy version) + `summary | null`
   (null until completed). Only `GET /backtests` returns list items; other endpoints are unchanged.
2. Query params (all optional, combined with AND; still newest version only): `dataSource`, `status`, `strategyId`,
   `q` (name contains, case-insensitive), `segment`, `timeframe`, `minReturn`, `minCagr`, `maxDrawdown` (positive
   number: drawdown not worse than −N %), `minWinRate`, `minTrades`, `minProfitFactor`, `profitable` (`true` = net
   P&L > 0). Any metric filter keeps completed runs only. Bad values → 422.
3. `sort` = `created` (default) | `netPnl` | `return` | `cagr` | `maxDrawdown` | `winRate` | `profitFactor` |
   `sharpe` | `trades`, `order` = `desc` (default) | `asc`; ties by `created_at desc, id`; runs without results last.
   A metric sort pages by `offset` only; a `cursor` with it → 400. `total` counts the filtered runs.
4. One query: join `backtest_results` and the strategy version spec (segment/timeframe from its JSON); no N+1.
5. `GET /strategies/stats?dataSource=history|recorded`: counts and bests from that source's runs only; absent = all.
6. Services: `BacktestFilter` gets every param above; `useStrategyStats({ dataSource })`.

## Acceptance checks
- [ ] Tests per filter and per sort (asc/desc), nulls last, `total` after filtering, cursor + metric sort → 400.
- [ ] A list item's summary matches `GET /backtests/{id}/result` metrics; a queued run has `summary: null`.
- [ ] Stats with `dataSource=recorded` ignore history runs.
- [ ] `pnpm review:check`; `docker compose run --rm backend-check`.
- [ ] Deploy (any time, no migration): `docker compose up -d --build --no-deps backtest strategy`.

## Out of scope
- Screens (171, 172, 176), saved filters, CSV export.

## Questions

## Handoff
