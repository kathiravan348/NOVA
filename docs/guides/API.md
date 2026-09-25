# NOVA — API reference (what each endpoint does)

> State as of 25 Sep 2026 (NOVA-076). Wire types: `docs/CONTRACTS.md`. Try it live: set `NOVA_API_DOCS=true`
> in `.env`, restart, open http://127.0.0.1:8000/api/v1/docs (dev machine only, D50).
> Update in the same task as any endpoint or CLI change (`AGENTS.md` §7a).

## How the API is organised

```
Browser (Orbit :3000 / Relay :3001, same-origin /api proxy)
   │  session cookie "nova_session" (HttpOnly)
   ▼
NOVA Core :8000  /api/v1/...   sign-in, /me, /audit  +  gateway
   │  forwards by first path segment, adds x-nova-user-id / x-nova-user-name / x-nova-internal-token
   ├── /broker/*        → broker service   (the only service that talks to Zerodha Kite, D35)
   ├── /strategies/*    → strategy service
   ├── /backtests/*     → backtest service (+ backtest worker)
   ├── /market-data/*   → Atlas            (+ Atlas worker)
   └── /data-jobs/*     → Atlas
```

**Common rules**
- Base path `/api/v1`. Everything except `POST /auth/login` and `GET /health` needs a signed-in session → else `401 unauthorized`.
- Services only accept calls from Core (internal token); they are not reachable from the browser directly.
- JSON field names are camelCase. Money is **integer paise** (`₹1 = 100`), fields end in `Paise`. Times are UTC ISO-8601.
- Errors always look like `{ "code": "invalid_request" | "unauthorized" | "not_found" | "internal", "message": "…" }`
  with status 400 / 401 / 404 / 5xx. `502` = a service is down; `503` = Kite rate limit busy.
- Paged lists return `{ "items": [...], "nextCursor": "…" | null }`. Query `limit` 1–200 (default 50), and
  `cursor` = the previous `nextCursor` to get the next page.
- Every write is recorded in the audit log (action name shown per endpoint below).

---

## 1. NOVA Core — sign-in, user, audit

| Method & path | What it does | Input | Output |
|---|---|---|---|
| `GET /health` | Liveness check (each service has one). | — | `{status:"ok"}` |
| `POST /auth/login` | Signs in the super-admin. Checks email (case-insensitive) + password; sets the `nova_session` cookie (valid `NOVA_SESSION_HOURS`, default 12 h). Failed tries are audited too. Audit: `auth.login`. | `LoginRequest {email, password}` | `User`; 401 "Wrong email or password" |
| `POST /auth/logout` | Revokes the current session and clears the cookie. Audit: `auth.logout`. | cookie | 204 |
| `GET /me` | Who is signed in (the apps call it on start-up). | cookie | `User {id, name, email, role, createdAt, lastLoginAt}` |
| `GET /audit` | The audit log, newest first, paged. | `limit`, `cursor` | `Page<AuditEntry>` |
| `GET /openapi.json`, `GET /docs` | Merged OpenAPI schema + Swagger UI of all services. Only when `NOVA_API_DOCS=true`. | — | JSON / HTML |

## 2. Broker service — Zerodha accounts, Kite login, rate limits (`/broker`)

| Method & path | What it does | Input | Output |
|---|---|---|---|
| `GET /broker/accounts` | Lists Zerodha accounts with their session status (`active` / `expired` / `not_logged_in`), login and expiry times. Notices newly expired sessions (audit `broker.session_expired`). | — | `BrokerAccount[]` |
| `POST /broker/accounts` | Adds a Zerodha account (not logged in) and its default rate-limit rules, like the `add-account` command. The label is stored trimmed and the client ID upper-cased. Audit: `broker.account_create` ("Added Main (AB1234)"). | `BrokerAccountCreate {label (≤ 60, not blank), clientId (4–12 letters/digits)}` | 201 `BrokerAccount`; 400 bad body or client ID already exists |
| `GET /broker/accounts/{id}` | One account, same shape. | path `id` | `BrokerAccount`; 404 |
| `GET /broker/accounts/{id}/login` | **Browser navigation, not JSON.** Starts the daily Kite login: redirects (302) to Zerodha's login page with a signed `state`. 400 if the account is disabled. | path `id` | 302 → Kite |
| `GET /broker/kite/callback` | **Kite sends the browser here after login.** Checks `state`, swaps `request_token` for an access token, checks the Zerodha user ID matches the account, stores the token **encrypted**, sets expiry to the next 06:00 IST. Audit: `broker.login` (success or failure with reason). | query `state`, `status`, `request_token` | 302 → Relay `/accounts/{id}?kite=connected\|failed` |
| `GET /broker/profiles` | Zerodha setup facts: API, plan, renewal, API key last 4 characters, redirect/postback URL, static IP, session rule, useful links. | — | `BrokerProfile[]` |
| `GET /broker/profiles/{broker}` | One profile (`zerodha`). | path | `BrokerProfile`; 404 |
| `GET /broker/rate-limits` | For each account × endpoint (`quote`, `historical`, `orders`, `other`): one rule per window (`second`, `minute`, `day`) with `brokerLimit`, `novaLimit`, `used` (live from Redis), `resetsAt` (day window), plus `throttledToday`. | — | `RateLimit[]` |
| `PATCH /broker/rate-limits/{accountId}/{endpoint}` | Changes NOVA's own limit for one window. Must be ≥ 1 and ≤ the broker limit. Audit: `broker.rate_limit_update` ("orders per day: 4,500 → 4,200"). | `RateLimitUpdate {window, novaLimit}` | 204; 400 above broker limit; 404 |
| `GET /broker/recorder` | The live tick recording switch: `enabled`, chosen `symbols` (empty = every stock synced with Kite) and `state`: `off`; `waiting` (outside 09:15–15:30 IST on weekdays); `recording` (`jobId` = the running `tick_record` job); `no_login` (market hours but no live Kite session). | — | `RecorderSettings` |
| `PUT /broker/recorder` | Turns recording on or off and sets its stocks (sorted, duplicates dropped). Turning on needs every chosen stock synced with Kite (or at least one synced stock when none are chosen). The always-on recorder picks the change up within 30 s. Audit: `settings.update` ("Tick recording on: 2 stock(s)" / "Tick recording off"), target `settings` / `recorder`. | `RecorderSettingsUpdate {enabled, symbols (≤ 3,000)}` | `RecorderSettings`; 400 stock not synced |

**Internal only (not under `/api/v1`, never forwarded by Core; only NOVA services with the internal token):**

| Method & path | What it does |
|---|---|
| `GET /internal/kite/instruments/{exchange}` | Kite's instrument list (CSV) for `NSE` or `NFO`. Used by Atlas `sync-instruments`. |
| `GET /internal/kite/historical?instrument_token=&interval=&start=&end=` | Historical candles from Kite. Used by Atlas download jobs. |

Both use the first enabled account with a live session (else 400 "Log in to Kite in Relay first") and wait for a
rate-limiter slot first (up to 20 s, else 503).

## 3. Strategy service — strategies and versions (`/strategies`)

| Method & path | What it does | Input | Output |
|---|---|---|---|
| `GET /strategies` | All strategies with every version (oldest first). | — | `Strategy[]` |
| `GET /strategies/stats` | Per strategy, computed in SQL from its backtests: runs by status, last run, best/worst return, win-rate range, worst drawdown, best net P&L (+ run id). Powers the strategy cards. | — | `StrategyStats[]` |
| `GET /strategies/{id}` | One strategy with versions. | path | `Strategy`; 404 |
| `POST /strategies` | Creates a strategy as `draft`, version 1 (note "First version"). Audit: `strategy.create`. | `StrategyCreate {name, description, spec}` | 201 `Strategy` |
| `POST /strategies/{id}/versions` | Saves a **new immutable version** (latest + 1). Old versions never change. Audit: `strategy.update`. | `StrategyVersionCreate {note, spec}` | 201 `Strategy` |
| `PATCH /strategies/{id}` | Renames, changes description or status (`draft` / `active` / `archived`). At least one field. Audit: `strategy.update`. | `StrategyUpdate {name?, description?, status?}` | `Strategy`; 400 if empty |

Visual specs (D51): indicator operands use the 38-indicator catalog (`frontend/packages/contracts/schema/indicators.json`:
name, label, group, params with default and whole-number flag). Price and indicator operands take optional
`offset` (bars ago, 0–500; absent = 0, and 0 is never written back). Both write bodies refuse unknown settings,
whole-number settings below 1 or with decimals, decimal settings ≤ 0, and `fast ≥ slow` → 400 `invalid_request`.
Reads stay tolerant, so strategies saved before the catalog still load.

Cost averaging (D53): optional `averaging {dropPercent (> 0, ≤ 50), maxAdds (whole 1–10)}` on both spec modes;
absent = off, and it is never written when off. The backtest then buys again (normal sizing) each time the
price falls `dropPercent` below the last buy, up to `maxAdds` times; stop-loss/target use the average price and
the whole position is one `Trade` (qty = all shares, `entryPricePaise` = average, gross from the exact cost).

`spec` holds: mode (`visual` rules or `python` code), segment, exchange, timeframe, entry/exit rule groups
(`all`/`any` of conditions *operand · op · operand*), sizing (fixed qty / fixed amount / percentage), stop-loss %, target %.
No delete in Phase 1 (runs refer to versions).

## 4. Backtest service — runs, results, trades (`/backtests`)

| Method & path | What it does | Input | Output |
|---|---|---|---|
| `GET /backtests` | Runs, newest first, paged; optional filter by strategy. | `strategyId`, `limit`, `cursor` | `Page<BacktestRun>` |
| `GET /backtests/{id}` | One run: status (`queued` → `running` → `completed` / `failed`), universe, period, capital, benchmark, times, error. | path | `BacktestRun`; 404 |
| `GET /backtests/{id}/result` | Metrics (gross/charges/net P&L, return, CAGR, max drawdown, Sharpe, win rate, trade/win/loss counts), equity curve, per-symbol breakdown. Only once completed. | path | `BacktestResult`; 404 until done |
| `GET /backtests/{id}/trades` | Simulated trades, oldest first, paged, each with the full charges breakdown. | `limit`, `cursor` | `Page<Trade>` |
| `POST /backtests` | Queues a run. Checks the strategy version exists and every symbol is a known NSE instrument. The **backtest worker** picks it up from the Postgres queue and fills result + trades. Audit: `backtest.run`. | `BacktestRunCreate {strategyId, strategyVersion, name, universe (symbols or index), from, to, initialCapitalPaise, benchmark?}` | 201 `BacktestRun` (`queued`); 400 unknown symbols; 404 |

## 5. NOVA Atlas — market data and data jobs

| Method & path | What it does | Input | Output |
|---|---|---|---|
| `GET /market-data/instruments` | Every instrument that has daily candles, with stats computed from them: last close, day change %, 52-week high/low, 20-day average volume, lot size, sector, indices, available timeframes, data from/to (IST dates). | `exchange` (default `NSE`) | `Instrument[]` |
| `GET /market-data/candles` | OHLCV bars for one symbol and timeframe (`1m 3m 5m 15m 30m 1h 1d`). Default range: last 365 days (daily) or 5 days (intraday). Max 3,660 days daily / 60 days intraday. Daily bars carry an IST date, intraday a UTC time. | `symbol`, `timeframe`, `from?`, `to?`, `exchange?` | `Candle[]`; 404 unknown symbol; `[]` if no bars |
| `GET /market-data/universe` | The stock list (what can be downloaded and synced), by symbol. `synced` = Kite knows the stock (its instrument has a token). | — | `UniverseEntry[]` |
| `POST /market-data/universe` | Adds a stock. Name and sector are stored trimmed. Audit: `instrument.add` ("Added M&M (Mahindra & Mahindra)"). | `UniverseEntryWrite {symbol (NSE style: A–Z, 0–9, &, -), name, sector (≤ 80), indices}` | 201 `UniverseEntry`; 400 bad body or already listed |
| `PUT /market-data/universe/{symbol}` | Changes name, sector and indices. The symbol itself cannot change. Audit: `instrument.update`. | path + `UniverseEntryWrite` (same symbol) | `UniverseEntry`; 400; 404 |
| `DELETE /market-data/universe/{symbol}` | Removes a stock from the list. Its downloaded candles and its `instruments` row stay. Audit: `instrument.remove`. | path | 204; 400 while a queued or running job uses it; 404 |
| `POST /market-data/instruments/sync` | Asks Kite (through the broker) for instrument tokens and F&O lot sizes of every listed stock, like `sync-instruments`. Needs a Kite login. Audit: `instrument.sync` ("Synced 23; not on Kite NSE: XYZ"). | — | `InstrumentSyncResult {synced, missing}`; 400 broker error (e.g. not logged in) |
| `GET /data-jobs` | Background jobs, newest first, paged: type (`historical_download`, `tick_record`, `archive`), status, symbols, timeframe, period, progress %, rows written, error. | `limit`, `cursor` | `Page<DataJob>` |
| `GET /data-jobs/{id}` | One job. | path | `DataJob`; 404 |
| `POST /data-jobs` | Queues a historical candle download for the Atlas worker, like the `download` command. Symbols are upper-cased and must be in the stock list. Audit: `data_job.create` ("Queued 1d download of 2 symbol(s), 2025-01-01 to 2025-12-31"). | `DataJobCreate {symbols (1–200), timeframe, from, to, segment? (default `equity_delivery`)}` | 201 `DataJob` (`queued`); 400 bad body or unknown symbol |
| `POST /data-jobs/{id}/cancel` | Cancels a `queued` job at once, or a `running` one: the worker stops before its next chunk (rows already saved stay). Cancelling a running `tick_record` job stops the recording and turns the recorder switch off. Audit: `data_job.cancel` ("Cancelled 1d download of 2 symbol(s)"). | path | `DataJob` (`cancelled`); 400 "Job is already …" (completed, failed or cancelled); 404 |

---

## 6. Command-line actions (admin, not HTTP)

| Command | Does |
|---|---|
| `python -m nova_core create-admin` | Creates the super-admin user (asks for the password). |
| `python -m nova_broker add-account` | Adds a Zerodha account (+ its default rate-limit rules). |
| `python -m nova_broker new-token-key` | Makes the key used to encrypt Kite tokens. |
| `python -m nova_broker record-ticks` | Records live ticks now, by hand, until 15:30 IST (no data job). |
| `python -m nova_broker recorder` | The always-on recorder (Compose service `tick-recorder`): follows `recorder_settings`, one `tick_record` job per session. |
| `python -m nova_atlas sync-instruments` | Loads instruments from the stock list (`universe` table) + Kite, like `POST /market-data/instruments/sync`. |
| `python -m nova_atlas download` | Queues a historical candle download job. |
| `python -m nova_atlas archive-ticks` | Moves old ticks to Parquet files and deletes them from the database. |
| `python -m nova_db upgrade \| check` | Runs migrations / checks models match the database. |
