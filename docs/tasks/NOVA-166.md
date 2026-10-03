# NOVA-166 — Runs get a data source; strategies get seconds timeframes (D82)

**Status:** done · **Owner:** Claude · **Branch:** task/NOVA-166 · **Depends on:** NOVA-164 (migration 0027)

## Goal
A backtest run records whether it uses `history` or `recorded` data, strategies may use `1s 5s 15s 30s`, and
`POST /backtests` rejects pairs that cannot run. No engine change yet (NOVA-167 builds recorded runs).

## Read first
- `AGENTS.md`; `docs/DECISIONS.md` rows D60, D82
- `backend/libs/nova_contracts/src/nova_contracts/{common,strategy,backtest}.py`; `nova_backtest/{routes,convert,strategy_engine}.py`

## Files
Create:
- `backend/libs/nova_db/src/nova_db/migrations/versions/rev0028_backtest_data_source.py`
Modify:
- `backend/libs/nova_db/src/nova_db/models/backtest.py`, `libs/nova_db/tests/test_migrations.py`
- `backend/libs/nova_contracts/src/nova_contracts/{common,strategy,backtest}.py` (+ `__init__.py` export lines), their parity tests
- `backend/services/backtest/src/nova_backtest/{routes,convert,versions,strategy_engine}.py`, tests `test_api.py`, `test_versions.py`, `test_worker.py`
- `frontend/packages/contracts/src/{common,strategy,backtest}.ts` (+ tests), generated `schema/*.json` (`schema:update`)
- `frontend/packages/mocks/src/data.ts`, `frontend/packages/mocks/src/handlers/orbit.ts` (`dataSource: "history"` on every run)
- `docs/guides/{API.md,DATABASE.md}`, `docs/CONTRACTS.md`

## Build
1. Migration 0028 (down 0027): `backtest_runs.data_source` text not null default `'history'`, check in
   (`history`, `recorded`); `recorded_days_used` int null (≥ 0); `recorded_days_skipped` date[] not null default `'{}'`;
   `backtest_results.spread_cost_paise` bigint null.
2. Contracts: `DataSource = Literal["history","recorded"]`. `StrategyTimeframe` = `Timeframe` + `1s 5s 15s 30s`, used
   only by strategy specs (data jobs, coverage and market data keep `Timeframe`). `BacktestRun` + `BacktestVersion`
   get `data_source`, `recorded_days_used: int | None`, `recorded_days_skipped: list[IsoDate]`. Create and version
   bodies get `data_source: DataSource = "history"`. `BacktestMetrics.spread_cost_paise: NonNegPaise | None = None`.
3. Create / new version (400 `invalid_request`, plain messages): `recorded` needs segment `equity_intraday`
   ("Recorded data backtests are intraday only"); a seconds timeframe needs `recorded` ("Seconds candles exist
   only in recorded data"); `recorded` with a market filter: "Market filter is not available on recorded data yet".
4. A new version keeps the previous version's `dataSource` unless the body sends one.
5. Worker: a `recorded` run fails with "Recorded data backtests are not built yet" (NOVA-167 replaces this).
   `WARM_UP_DAYS` gets the seconds timeframes at 1 day.
6. Guides: API (fields, the three 400s), DATABASE (columns, migration 0028).

## Acceptance checks
- [ ] Old runs read back as `history` with `recordedDaysUsed: null`, `recordedDaysSkipped: []`.
- [ ] Create without `dataSource` stores `history`; each of the three 400s has a test.
- [ ] A strategy with timeframe `5s` saves; a data job with `5s` is still rejected (422).
- [ ] Migration up/down test; `pnpm review:check`; `docker compose run --rm backend-check`.
- [ ] Deploy after 15:45 IST or at a weekend (D76): `docker compose run --rm --no-deps migrate`, then
      `docker compose up -d --build --no-deps backtest backtest-worker strategy`.

## Out of scope
- Reading ticks (167), fills (168), any screen (169), list filters (170).

## Questions

## Handoff
- Built by Claude, 3 Oct 2026. Migration 0028 (`data_source`, `recorded_days_used`, `recorded_days_skipped`,
  `backtest_results.spread_cost_paise`). Contracts: `DataSource`, `StrategyTimeframe` (+ `SECONDS_TIMEFRAMES`),
  run/version fields, create `dataSource` (default history), version `dataSource` (null/absent = keep),
  `BacktestMetrics.spreadCostPaise`.
- `versions.check_source` + `strategy_spec` (the version create now also 404s an unknown strategy version).
  Engine fails recorded runs "Recorded data backtests are not built yet"; seconds warm-up 1 day.
- Frontend: to keep the build green, `timeframeLabel` gets the seconds labels and the editor/coverage helpers
  take `StrategyTimeframe` (so the editor already lists seconds options). NOVA-169 adds the hint, Data field
  and form rules. Mocks: every run `history`, results `spreadCostPaise: null`.
- Checks: frontend 1,086 tests, lint, typecheck, format, build pass; backend 1,362/1,363 — the one failure was
  `core/test_realtime.py::test_deleting_a_job_is_announced` (CancelledError), passes alone; flagged as a task.
- Guides: API, DATABASE (0028), CONTRACTS.

## Review
Self-review: yes (Owner allowed self-review on 3 Oct 2026). Matches the task. Deployed Saturday 3 Oct 2026:
`migrate`, then `backtest backtest-worker strategy` with `--no-deps`. Verdict: done.
