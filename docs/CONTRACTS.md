# NOVA — Contracts index

> One line per contract. Update in the same task that adds or changes a contract.
> Source: `frontend/packages/contracts/src/`. Mock: `frontend/packages/mocks/data/`. Handlers live in `mocks/src/handlers/`.
> JSON Schema (generated, D34): `frontend/packages/contracts/schema/<Contract>.json` — `pnpm --filter @nova/contracts schema:update`.
> Browser navigations, not JSON (D39): `GET /api/v1/broker/accounts/{id}/login` → 302 to Kite;
> `GET /api/v1/broker/kite/callback` → 302 back to Relay `/broker/{id}?kite=finish|failed`; Relay then posts
> `KitePassphrase` to `POST /api/v1/broker/accounts/{id}/login/finish` → `BrokerAccount` (D55).
> Pagination (D32): `Page<T>` = `{ items: T[], nextCursor: string | null }`; `limit` 1–200 (default 50), opaque `cursor`;
> bad values → 400 `invalid_request`. Other lists are bare arrays. Helpers: `pageSchema`, `PageQuery` in `common.ts`.
> Pydantic mirrors: `backend/libs/nova_contracts` (so far: User, ApiError, LoginRequest, AuditEntry, Page, BrokerAccount(+Create), BrokerProfile, KiteApp(+Update, KiteKeysUpdate, KitePassphrase), RateLimit, RateLimitUpdate, RecorderSettings(+Update), DataJob(+Create, ArchiveJobCreate, DataJobPlan, DataJobPlanRequest, DownloadSettings(+Update), UniverseSector), Instrument, Candle, UniverseEntry(+Write), MarketIndex, RealtimeMessage, Charges, Strategy (+ spec tree, write bodies), StrategyStats, BacktestRun(+Create), BacktestResult, Trade), checked with `nova_testing.parity`.

| Contract | Endpoint (Stage B) | Mock file | Used by |
|---|---|---|---|
| User | `GET /api/v1/me`; response of `POST /api/v1/auth/login` | `data/user.json` | Core, Orbit, Relay |
| LoginRequest | `POST /api/v1/auth/login` body → `User` + session cookie; `POST /api/v1/auth/logout` → 204 (D38) | — | Core |
| Strategy (rules only, no universe: D25) | `GET /api/v1/strategies`, `GET /api/v1/strategies/{id}`; response of the writes below | `data/strategies.json` | Orbit |
| Indicator catalog (D51: 38 indicators, params, groups; `INDICATORS`, `checkIndicatorParams`) | — (static; exported to `schema/indicators.json`, Python `nova_contracts.indicators`) | — | Orbit, backtest |
| StrategyCreate / StrategyVersionCreate / StrategyUpdate (D43; refuse bad indicator params, D51; optional `averaging`, D53) | `POST /api/v1/strategies` (201), `POST /api/v1/strategies/{id}/versions` (201), `PATCH /api/v1/strategies/{id}` | — (handlers answer from the body) | Orbit |
| BacktestRun (with `universe`: symbols or index) | `GET /api/v1/backtests?strategyId=&limit=&cursor=` → `Page<BacktestRun>`, `GET /api/v1/backtests/{id}` | `data/backtestRuns.json` | Orbit |
| BacktestRunCreate (D44) | `POST /api/v1/backtests` → 201 `BacktestRun` (`queued`) | — (handler answers from the body) | Orbit |
| StrategyStats (runs by status, last run, best/worst return, win-rate range, worst drawdown, best net P&L) | `GET /api/v1/strategies/stats` | `data/strategyStats.json` | Orbit |
| BacktestResult (metrics, equity curve, `bySymbol` breakdown) | `GET /api/v1/backtests/{id}/result` | `data/backtestResults.json` | Orbit |
| Trade | `GET /api/v1/backtests/{id}/trades?limit=&cursor=` → `Page<Trade>` | `data/trades.json` | Orbit |
| Charges | — | `data/trades.json` (inside each trade) | Ledger, Orbit, ui-trading |
| BrokerAccount | `GET /api/v1/broker/accounts`, `GET /api/v1/broker/accounts/{id}` | `data/brokerAccounts.json` | Relay |
| BrokerAccountCreate | `POST /api/v1/broker/accounts` → 201 `BrokerAccount` (400 `invalid_request` bad body or duplicate client ID) | — (mock: validated, not stored) | Relay |
| RateLimit (v2: `rules[]` per window with brokerLimit, novaLimit, used, resetsAt) | `GET /api/v1/broker/rate-limits` | `data/rateLimits.json` | Relay |
| RateLimitUpdate | `PATCH /api/v1/broker/rate-limits/{accountId}/{endpoint}` → 204 (400 `invalid_request` above broker limit) | — (Stage A: validated, not stored) | Relay |
| RecorderSettings | `GET /api/v1/broker/recorder`, `PUT /api/v1/broker/recorder` (body `RecorderSettingsUpdate`; 400 stock not synced) | — | Relay |
| RecorderSettingsUpdate | body of `PUT /api/v1/broker/recorder` | — | Relay |
| BrokerProfile (broker facts only since D55) | `GET /api/v1/broker/profiles`, `GET /api/v1/broker/profiles/{broker}` | `data/brokerProfiles.json` | Relay |
| KiteApp (D55; `apiKeyLast4` + `secretSaved`, never the secret) | `GET /api/v1/broker/accounts/{id}/kite-app`; also returned by the two writes below | `data/kiteApps.json` | Relay |
| KiteKeysUpdate | `PUT /api/v1/broker/accounts/{id}/kite-app/keys` → `KiteApp` | — | Relay |
| KiteAppUpdate | `PATCH /api/v1/broker/accounts/{id}/kite-app` → `KiteApp` | — | Relay |
| KitePassphrase | `POST /api/v1/broker/accounts/{id}/kite-app/check` → 204 (400 wrong passphrase) | — | Relay |
| DataJob | `GET /api/v1/data-jobs?limit=&cursor=` → `Page<DataJob>`, `GET /api/v1/data-jobs/{id}`, `POST /api/v1/data-jobs/{id}/cancel` → `DataJob` (400 already finished); `POST /api/v1/market-data/instruments/sync` → 202 `DataJob` | `data/dataJobs.json` | Relay |
| DataJobCreate | `POST /api/v1/data-jobs` → 201 `DataJob` `queued` (400 `invalid_request` bad body, unknown symbol) | — (mock: validated, not stored) | Relay |
| ArchiveJobCreate | `POST /api/v1/data-jobs/archive` → 201 `DataJob` `archive` (400 future date or no ticks before it) | — | Relay |
| DataJobPlan / DataJobPlanRequest | `POST /api/v1/data-jobs/plan` → 201 `DataJob` `draft` with `plan`; `POST …/{id}/start|pause|resume` → `DataJob` (D57) | — | Relay |
| DownloadSettings | Pace during market hours (`slow`/`full`, D57). `GET`/`PATCH /api/v1/data-jobs/settings` | — | Relay |
| UniverseSector | `GET /api/v1/market-data/universe/sectors` → `UniverseSector[]` (D57 bulk pick) | — | Relay |
| RealtimeMessage | WebSocket `/api/v1/ws`: `hello` · `ping` · `data_job.updated {data: DataJob}` (D57) | — (no mock socket) | Relay (NOVA-091) |
| AuditEntry | `GET /api/v1/audit?limit=&cursor=` → `Page<AuditEntry>` | `data/auditEntries.json` | Relay |
| Instrument | `GET /api/v1/market-data/instruments` | `data/instruments.json` | Orbit (symbol, sector, indices, lastClose, 52w range, volume, lotSize, data range) |
| UniverseEntry | `GET /api/v1/market-data/universe` → `UniverseEntry[]`; `POST` → 201, `PUT /{symbol}` → 200, `DELETE /{symbol}` → 204 (400 duplicate, symbol change or used by a waiting job; 404) | — | Relay |
| UniverseEntryWrite | body of `POST /api/v1/market-data/universe` and `PUT /api/v1/market-data/universe/{symbol}` | — | Relay |
| MarketIndex | contract only so far `GET /api/v1/market-data/indices` → `MarketIndex[]`. `IndexName` is any 1–40 char name of capitals, digits, spaces, `&`, `-`; Atlas checks it exists in `market_indices` | — | Relay, Orbit |
| Candle | `GET /api/v1/market-data/candles?symbol=&timeframe=` | `data/candles.json` (keyed `SYMBOL:tf`) | Orbit, ui-trading |
| ApiError | any endpoint (400/401/404/5xx; codes `invalid_request`, `unauthorized`, `not_found`, `internal`) | — | Core, Orbit, Relay |
