# NOVA — Contracts index

> One line per contract. Update in the same task that adds or changes a contract.
> Source: `frontend/packages/contracts/src/`. Mock: `frontend/packages/mocks/data/`. Handlers live in `mocks/src/handlers/`.
> JSON Schema (generated, D34): `frontend/packages/contracts/schema/<Contract>.json` — `pnpm --filter @nova/contracts schema:update`.
> Pagination (D32): `Page<T>` = `{ items: T[], nextCursor: string | null }`; `limit` 1–200 (default 50), opaque `cursor`;
> bad values → 400 `invalid_request`. Other lists are bare arrays. Helpers: `pageSchema`, `PageQuery` in `common.ts`.
> Pydantic mirrors: `backend/libs/nova_contracts` (so far: User, ApiError), checked with `nova_testing.parity`.

| Contract | Endpoint (Stage B) | Mock file | Used by |
|---|---|---|---|
| User | `GET /api/v1/me` | `data/user.json` | Core, Orbit, Relay |
| Strategy (rules only, no universe: D25) | `GET /api/v1/strategies`, `GET /api/v1/strategies/{id}` | `data/strategies.json` | Orbit |
| BacktestRun (with `universe`: symbols or index) | `GET /api/v1/backtests?strategyId=&limit=&cursor=` → `Page<BacktestRun>`, `GET /api/v1/backtests/{id}` | `data/backtestRuns.json` | Orbit |
| StrategyStats (runs by status, last run, best/worst return, win-rate range, worst drawdown, best net P&L) | `GET /api/v1/strategies/stats` | `data/strategyStats.json` | Orbit |
| BacktestResult (metrics, equity curve, `bySymbol` breakdown) | `GET /api/v1/backtests/{id}/result` | `data/backtestResults.json` | Orbit |
| Trade | `GET /api/v1/backtests/{id}/trades?limit=&cursor=` → `Page<Trade>` | `data/trades.json` | Orbit |
| Charges | — | `data/trades.json` (inside each trade) | Ledger, Orbit, ui-trading |
| BrokerAccount | `GET /api/v1/broker/accounts`, `GET /api/v1/broker/accounts/{id}` | `data/brokerAccounts.json` | Relay |
| RateLimit (v2: `rules[]` per window with brokerLimit, novaLimit, used, resetsAt) | `GET /api/v1/broker/rate-limits` | `data/rateLimits.json` | Relay |
| RateLimitUpdate | `PATCH /api/v1/broker/rate-limits/{accountId}/{endpoint}` → 204 (400 `invalid_request` above broker limit) | — (Stage A: validated, not stored) | Relay |
| BrokerProfile | `GET /api/v1/broker/profiles`, `GET /api/v1/broker/profiles/{broker}` | `data/brokerProfiles.json` | Relay |
| DataJob | `GET /api/v1/data-jobs?limit=&cursor=` → `Page<DataJob>`, `GET /api/v1/data-jobs/{id}` | `data/dataJobs.json` | Relay |
| AuditEntry | `GET /api/v1/audit?limit=&cursor=` → `Page<AuditEntry>` | `data/auditEntries.json` | Relay |
| Instrument | `GET /api/v1/market-data/instruments` | `data/instruments.json` | Orbit (symbol, sector, indices, lastClose, 52w range, volume, lotSize, data range) |
| Candle | `GET /api/v1/market-data/candles?symbol=&timeframe=` | `data/candles.json` (keyed `SYMBOL:tf`) | Orbit, ui-trading |
| ApiError | any endpoint (400/404/500; codes `invalid_request`, `not_found`, `internal`) | — | Core, Orbit, Relay |
