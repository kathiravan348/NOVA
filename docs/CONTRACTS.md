# NOVA — Contracts index

> One line per contract. Update in the same task that adds or changes a contract.
> Source: `frontend/packages/contracts/src/`. Mock: `frontend/packages/mocks/data/`. Handlers live in `mocks/src/handlers/`.

| Contract | Endpoint (Stage B) | Mock file | Used by |
|---|---|---|---|
| User | `GET /api/v1/me` | `data/user.json` | Core, Orbit, Relay |
| Strategy | `GET /api/v1/strategies`, `GET /api/v1/strategies/{id}` | `data/strategies.json` | Orbit |
| BacktestRun | `GET /api/v1/backtests`, `GET /api/v1/backtests/{id}` | `data/backtestRuns.json` | Orbit |
| BacktestResult | `GET /api/v1/backtests/{id}/result` | `data/backtestResults.json` | Orbit |
| Trade | `GET /api/v1/backtests/{id}/trades` | `data/trades.json` | Orbit |
| Charges | — | `data/trades.json` (inside each trade) | Ledger, Orbit, ui-trading |
| BrokerAccount | `GET /api/v1/broker/accounts`, `GET /api/v1/broker/accounts/{id}` | `data/brokerAccounts.json` | Relay |
| RateLimit | `GET /api/v1/broker/rate-limits` | `data/rateLimits.json` | Relay |
| DataJob | `GET /api/v1/data-jobs`, `GET /api/v1/data-jobs/{id}` | `data/dataJobs.json` | Relay |
| AuditEntry | `GET /api/v1/audit` | `data/auditEntries.json` | Relay |
| Instrument | `GET /api/v1/market-data/instruments` | `data/instruments.json` | Orbit |
| Candle | `GET /api/v1/market-data/candles?symbol=&timeframe=` | `data/candles.json` (keyed `SYMBOL:tf`) | Orbit, ui-trading |
| ApiError | any endpoint (404/500) | — | Core, Orbit, Relay |
