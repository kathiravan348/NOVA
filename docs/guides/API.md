# NOVA — API reference (what each endpoint does)

> State as of 28 Sep 2026 (NOVA-139). Wire types: `docs/CONTRACTS.md`. Try it live: set `NOVA_API_DOCS=true`
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
- Errors always look like `{ "code": "invalid_request" | "unauthorized" | "forbidden" | "not_found" | "internal", "message": "…" }`
  with status 400 / 401 / 403 / 404 / 5xx. `502` = a service is down; `503` = Kite rate limit busy.
- Paged lists return `{ "items": [...], "nextCursor": "…" | null }`. Query `limit` 1–200 (default 50), and
  `cursor` = the previous `nextCursor` to get the next page.
- Every write is recorded in the audit log (action name shown per endpoint below).

---

## 1. NOVA Core — sign-in, user, audit

| Method & path | What it does | Input | Output |
|---|---|---|---|
| `GET /health` | Liveness check (each service has one). | — | `{status:"ok"}` |
| `POST /auth/login` | Signs in a super-admin or enabled agent. Checks email (case-insensitive) + password; sets the `nova_session` cookie (valid `NOVA_SESSION_HOURS`, default 12 h). Failed tries are audited too. Audit: `auth.login`. | `LoginRequest {email, password}` | `User`; 401 "Wrong email or password" |
| `POST /auth/logout` | Revokes the current session and clears the cookie. Audit: `auth.logout`. | cookie | 204 |
| `GET /me` | Who is signed in (the apps call it on start-up). | cookie | `User {id, name, email, role, createdAt, lastLoginAt}` |
| `GET /audit` | The audit log, newest first, paged. | `limit`, `cursor` | `Page<AuditEntry>` |
| `GET /approvals` | Held requests, newest first; admins see all, agents only their own. Expires unclaimed pending requests after 30 minutes before listing. | optional `status`, `limit`, `cursor` | `Page<ApprovalRequest>` |
| `POST /approvals/{id}/approve` | Admin only. Durably claims a pending request, then replays its saved method/path/query/JSON as the agent. Stores upstream status and first 8,000 response characters; `done` for 2xx, otherwise `failed`. No answer stores `failed` and the error message, with null `resultStatus`. Audit: `approval.approve` ("Approved POST /backtests → 201"). | — | `ApprovalRequest`; 400 "Already decided or expired" if missing, expired or already claimed/decided |
| `POST /approvals/{id}/reject` | Admin only. Rejects an unclaimed pending request. Audit: `approval.reject`. | — | `ApprovalRequest`; 400 "Already decided or expired" otherwise |
| `GET /agent` | Admin only. Reads the single agent account. | — | `AgentAccount`; 404 if none |
| `POST /agent` | Admin only. Creates the single agent account, enabled initially; email must be unused (case-insensitive), password at least 12 characters, stored with the same scrypt hash as the admin. Audit: `agent.create`. | `AgentAccountCreate {name, email, password}` | 201 `AgentAccount`; 400 for invalid input, duplicate email or existing agent |
| `PUT /agent/password` | Admin only. Changes password and revokes every agent session. Audit: `agent.password`. | `AgentPasswordUpdate {password}` (at least 12 characters) | `AgentAccount`; 404 if none, 400 for invalid input |
| `PATCH /agent` | Admin only. Sets/clears `disabled_at`; off revokes every agent session and refuses sign-in. On requires a fresh sign-in. Audit: `agent.access` ("Agent access off" / "Agent access on"). | `AgentAccessUpdate {enabled}` | `AgentAccount`; 404 if none |
| `GET /openapi.json`, `GET /docs` | Merged OpenAPI schema + Swagger UI of all services. Only when `NOVA_API_DOCS=true`. | — | JSON / HTML |
| `GET /ws` (WebSocket) | Live updates for signed-in screens (D57). Signed in with the `nova_session` cookie; without a valid one the socket is accepted and closed with code **4401**. Server sends `{type:"hello"}` first, `{type:"ping"}` every 25 s (`NOVA_WS_PING_SECONDS`), `{type:"data_job.updated", data: DataJob}` whenever any data job is created or changed (at most one per job per 250 ms; always the latest state), and `{type:"data_job.deleted", data:{id}}` when one is deleted. The session is re-checked every 60 s (`NOVA_WS_SESSION_CHECK_SECONDS`); a signed-out or expired session is closed with 4401. Client messages are ignored (`{type:"pong"}` expected). | cookie | `RealtimeMessage` stream |

**Agent gateway rules (D67, NOVA-131):** `User.role` is `super_admin` or `agent`. Disabled agents
cannot sign in or use existing HTTP/WebSocket sessions. `/me`, `/audit`, sign-out and `/ws` accept both roles.
The agent may GET under `/strategies`, `/backtests`, `/market-data`, `/data-jobs`, and POST exactly
`/data-jobs/plan` (draft only). Every other POST/PUT/PATCH/DELETE under those prefixes is held: Core saves
method, path relative to `/api/v1` (e.g. `/backtests`), raw query and optional JSON body (at most 64 KB), audits `approval.request`
("Asked: POST /backtests", target `approval_request`), and returns **202 `ApprovalRequest`** with
`x-nova-approval: apr_...`. The service is not called. Invalid JSON or an oversized body returns 400.
Every `/broker` request and every unlisted prefix is refused with **403 `forbidden`**,
"The agent account may not do this". Agents also receive 403 for approval decisions and every agent
account management endpoint. Super-admin forwarding is unchanged. Approval claims set `decidedAt`
and `decidedBy` before replay; a claimed request cannot run again, be rejected or expire while running.

## 2. Broker service — Zerodha accounts, Kite login, rate limits (`/broker`)

| Method & path | What it does | Input | Output |
|---|---|---|---|
| `GET /broker/accounts` | Lists Zerodha accounts with their session status (`active` / `expired` / `not_logged_in`), login and expiry times. Notices newly expired sessions (audit `broker.session_expired`). | — | `BrokerAccount[]` |
| `POST /broker/accounts` | Adds a Zerodha account (not logged in) and its default rate-limit rules. The label is stored trimmed and the client ID upper-cased. Audit: `broker.account_create` ("Added Main (AB1234)"). | `BrokerAccountCreate {label (≤ 60, not blank), clientId (4–12 letters/digits)}` | 201 `BrokerAccount`; 400 bad body or client ID already exists |
| `GET /broker/accounts/{id}` | One account, same shape. | path `id` | `BrokerAccount`; 404 |
| `GET /broker/accounts/{id}/login` | **Browser navigation, not JSON.** Starts the daily Kite login: redirects (302) to Zerodha's login page with the account's **own API key** (D55) and a signed `state`. 400 if the account is disabled or has no saved Kite keys. | path `id` | 302 → Kite |
| `GET /broker/kite/callback` | **Kite sends the browser here after login.** Checks `state`, keeps `request_token` in Redis for 2 minutes (one use) and sends the browser back to Relay to ask the passphrase. A cancelled login is audited `broker.login` (failure). | query `state`, `status`, `request_token` | 302 → Relay `/broker/{id}?kite=finish\|failed` |
| `POST /broker/accounts/{id}/login/finish` | Finishes the login: the passphrase opens the sealed API secret for this request only, the pending token is exchanged, the Zerodha user ID must match the account, the access token is stored **encrypted** until the next 06:00 IST. Audit: `broker.login` (success or failure with reason). A wrong passphrase can be retried; the 5th wrong one drops the pending login. | `KitePassphrase {passphrase}` | `BrokerAccount`; 400 "Wrong passphrase", "Login expired: log in to Kite again", Kite error or other user; 404 |
| `GET /broker/accounts/{id}/kite-app` | The account's own Kite app (D55): API key **last 4 characters**, whether a secret is saved (never the secret), plan, renewal date, redirect URL (`{NOVA_RELAY_URL}/api/v1/broker/kite/callback`, to paste into the Kite developer console), postback URL, static IP. Empty values until saved. | path `id` | `KiteApp`; 404 |
| `PUT /broker/accounts/{id}/kite-app/keys` | Saves the API key and secret together; the secret is sealed with the passphrase (scrypt + AES-GCM, bound to the account) and the passphrase is not kept. A **different** API key ends the account's Kite session. Audit: `broker.kite_app_update` ("Saved Kite API key …AB12 and secret for Main"). | `KiteKeysUpdate {apiKey (6–64 letters/digits), apiSecret (no spaces, ≤ 128), passphrase (12–128)}` | `KiteApp`; 400 bad body; 404 |
| `PATCH /broker/accounts/{id}/kite-app` | Saves the app details (all nullable): plan (trimmed), renewal date, postback URL, static IP. Keys untouched. Audit: `broker.kite_app_update` ("Updated Kite app details for Main"). | `KiteAppUpdate {plan (≤ 60), subscriptionRenewsOn, postbackUrl, staticIp}` | `KiteApp`; 400; 404 |
| `POST /broker/accounts/{id}/kite-app/check` | Tests the passphrase: opens the sealed secret and forgets it. Not audited. | `KitePassphrase {passphrase}` | 204; 400 "Wrong passphrase" or "Save the Kite API key and secret first"; 404 |
| `GET /broker/profiles` | Zerodha facts from the repo data file: API, session rule, useful links. App details are per account (above). | — | `BrokerProfile[]` |
| `GET /broker/profiles/{broker}` | One profile (`zerodha`). | path | `BrokerProfile`; 404 |
| `GET /broker/rate-limits` | For each account × endpoint (`quote`, `historical`, `orders`, `other`): one rule per window (`second`, `minute`, `day`) with `brokerLimit`, `novaLimit`, `used` (live from Redis), `resetsAt` (day window), plus `throttledToday`. | — | `RateLimit[]` |
| `PATCH /broker/rate-limits/{accountId}/{endpoint}` | Changes NOVA's own limit for one window. Must be ≥ 1 and ≤ the broker limit. Audit: `broker.rate_limit_update` ("orders per day: 4,500 → 4,200"). | `RateLimitUpdate {window, novaLimit}` | 204; 400 above broker limit; 404 |
| `GET /broker/recorder` | The live tick recording switch: `enabled`, chosen `symbols` (empty = every stock synced with Kite) and `state`: `off`; `waiting` (outside 09:15–15:30 IST on weekdays); `recording` (`jobId` = the running `tick_record` job); `no_login` (market hours but no live Kite session). | — | `RecorderSettings` |
| `PUT /broker/recorder` | Turns recording on or off and sets its stocks (sorted, duplicates dropped). Turning on needs every chosen stock synced with Kite (or at least one synced stock when none are chosen). The always-on recorder picks the change up within 30 s. Audit: `settings.update` ("Tick recording on: 2 stock(s)" / "Tick recording off"), target `settings` / `recorder`. | `RecorderSettingsUpdate {enabled, symbols (≤ 3,000)}` | `RecorderSettings`; 400 stock not synced |

**Internal only (not under `/api/v1`, never forwarded by Core; only NOVA services with the internal token):**

| Method & path | What it does |
|---|---|
| `GET /internal/kite/instruments/{exchange}` | Kite's instrument list (CSV) for `NSE` or `NFO`. Used by the instrument sync (`POST /market-data/instruments/sync`). |
| `GET /internal/kite/historical?instrument_token=&interval=&start=&end=` | Historical candles from Kite. Used by Atlas download jobs. |
| `GET /internal/kite/session` | `{loggedIn, accountId}`: whether an enabled account has a live Kite session. No Kite call, no limiter slot. Used by the daily instrument sync (D56). |
| `GET /internal/nse/constituents?file=ind_nifty50list.csv` | One NSE index's members `[{symbol, company, industry}]` (`EQ` rows) from `NOVA_NSE_INDEX_BASE_URL` (default niftyindices.com). Not a Kite call, no limiter slot. 400 bad file name (`ind_…csv` only); 502 NSE did not answer, refused, or sent something else. Used by the instrument sync (D56). |

Both use the first enabled account with a live session (else 400 "Log in to Kite in Relay first") and wait for a
rate-limiter slot first (up to 20 s, else 503).

## 3. Strategy service — strategies and versions (`/strategies`)

| Method & path | What it does | Input | Output |
|---|---|---|---|
| `GET /strategies` | All strategies with every version (oldest first). | — | `Strategy[]` |
| `GET /strategies/stats` | Per strategy, computed in SQL from its backtests: runs by status, last run, best/worst return, win-rate range, worst drawdown, best net P&L (+ run id). Powers the strategy cards. `byVersion` (D60): for every strategy version, ascending, its completed runs and best return with that run id (null when none); runs of every backtest version count. | — | `StrategyStats[]` |
| `GET /strategies/library` | The strategy library (D62 (7)): 7 families (`id`, `name`, `idea`, `watch`) and 60 fixed entries (`id` A01–G10, `family`, `name`, `summary`, `spec`, `backtest` = the suggested first run: NIFTY 100, ₹10,00,000, NIFTY 50, in-sample dates). Shipped as data with the strategy service, checked at start-up (the service does not start if a file is invalid). | — | `StrategyLibrary` |
| `POST /strategies/library/install` | Adds the chosen entries as `draft` strategies, in the order given, in one transaction: name = entry name, description = summary, version 1 with note "From the library (A01)". Audit: `strategy.create` per strategy. | `LibraryInstall {ids}` (1–100, each once) | 201 `Strategy[]`; 400 unknown id (named), nothing added |
| `GET /strategies/{id}` | One strategy with versions. | path | `Strategy`; 404 |
| `POST /strategies` | Creates a strategy as `draft`, version 1 (note "First version"). Audit: `strategy.create`. | `StrategyCreate {name, description, spec}` | 201 `Strategy` |
| `POST /strategies/{id}/versions` | Saves a **new immutable version** (latest + 1). Old versions never change. Audit: `strategy.update`. | `StrategyVersionCreate {note, spec}` | 201 `Strategy` |
| `PATCH /strategies/{id}` | Renames, changes description or status (`draft` / `active` / `archived`). At least one field. Audit: `strategy.update`. | `StrategyUpdate {name?, description?, status?}` | `Strategy`; 400 if empty |
| `DELETE /strategies/{id}` | Deletes the strategy, all its versions and every backtest run of it (their results and trades too), D62. Refused while one of its runs is `running`; `queued` runs are deleted. Audit: `strategy.delete` ("Deleted strategy X (N backtest runs)"). | path | `BacktestDeleteResult {deletedRuns}`; 400 a run is running; 404 |

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
Versions are never deleted on their own; `DELETE /strategies/{id}` removes a whole strategy with its versions and backtests (D62).

## 4. Backtest service — runs, results, trades (`/backtests`)

| Method & path | What it does | Input | Output |
|---|---|---|---|
| `GET /backtests` | Runs, newest first, paged; optional filter by strategy. Only the **newest version** of each backtest is listed (D60); older versions come from `/versions`. | `strategyId`, `limit`, `cursor` | `Page<BacktestRun>` |
| `GET /backtests/{id}` | One run: status (`queued` → `running` → `completed` / `failed`), universe, period, capital, benchmark, times, error, and `progress` (D58): `null` until the worker starts it, else `{stage, percent, symbolsDone, symbolsTotal, barsDone, barsTotal, tradesSoFar, simulatedTo}`. Stages and percent bands: `loading` 0–20 (per stock), `signals` 20–30 (Python only), `simulating` 30–95 (per bar event, warm-up included; `simulatedTo` = IST date reached), `saving` 95–100, `done` 100 (always for `completed`). Written at most once a second; a failed run keeps its last progress. The list returns the same field. `skippedSymbols` (D68) is always a symbol array (`[]` when none): index runs skip members with no prices between `from` and `to` and report them here; only loaded members appear in `bySymbol`. If no member has prices, the run fails with "No stock in <index> has <tf> prices in the period (download them first)". Runs on chosen symbols still fail if any symbol has no prices. | path | `BacktestRun`; 404 |
| `GET /backtests/{id}/result` | Metrics (gross/charges/net P&L, return, CAGR, max drawdown, Sharpe, win rate, trade/win/loss counts), equity curve, per-symbol breakdown. Only once completed. D62 (NOVA-116), null on runs from before it: `benchmarkReturnPercent`, `benchmarkCagrPercent` (from the index's own 1d candles; null when the run has no benchmark or none are stored), `exposurePercent` (% of equity dates with a trade open), `avgHoldDays`, `profitFactor` (null without a losing trade), `calmar` (null with no drawdown), `estimatedTaxPaise`, `afterTaxNetPnlPaise`, `afterTaxCagrPercent` (delivery only: STCG 20 %, LTCG 12.5 % above ₹1.25 L per April–March year, + 4 % cess, taken at the end); each equity point's `benchmarkPaise`; `years` (12-month blocks from `from`: `year`, `from`, `to`, `returnPercent`, `profitPaise`, `maxDrawdownPercent`, `benchmarkPercent`; `[]` on older runs). | path | `BacktestResult`; 404 until done |
| `GET /backtests/{id}/trades` | Simulated trades, oldest first, paged, each with the full charges breakdown. | `limit`, `cursor` | `Page<Trade>` |
| `POST /backtests` | Queues a run. Checks the strategy version exists and every symbol is a known NSE instrument. The **backtest worker** picks it up from the Postgres queue and fills result + trades. Audit: `backtest.run`. | `BacktestRunCreate {strategyId, strategyVersion, name, universe (symbols or index), from, to, initialCapitalPaise, benchmark?}` | 201 `BacktestRun` (`queued`); 400 unknown symbols; 404 |
| `GET /backtests/{id}/versions` | Every version of the backtest the run belongs to, newest first (D60): settings, status, error, `reportKept`, and `metrics` when completed. A backtest is a chain of runs sharing `rootId` (the first run's id), numbered by `version`. | path | `BacktestVersion[]`; 404 |
| `POST /backtests/{id}/versions` | **Edit**: queues the next version of the backtest (same strategy; strategy version, stocks, period, capital, benchmark, name from the body). When a version completes, older completed versions keep only their metrics and `years`: trades deleted, result `equityCurve`/`bySymbol` emptied, `reportKept` false. Audit: `backtest.edit` ("Queued v2 of backtest IT basket"). | `BacktestVersionCreate` | 201 `BacktestRun` (`queued`); 400 "Wait for the running version to finish" (a version is queued or running), unknown symbols; 404 |
| `DELETE /backtests/{id}` | `scope=all` (default): deletes the whole backtest, every version with its trades and results. `scope=version`: only this older version. Audit: `backtest.delete` ("Deleted backtest IT basket (3 versions)" / "Deleted v1 of backtest IT basket"). | path, `scope` | `BacktestDeleteResult {deletedRuns}`; 400 "A running backtest cannot be deleted", "Delete the whole backtest instead" (`scope=version` on the newest); 404 |
| `POST /backtests/delete` | Deletes several whole backtests (every version of each id's backtest), all or nothing. Audit: `backtest.delete` ("Deleted 2 backtests (3 versions)"). | `BacktestDeleteRequest {ids (1–100)}` | `BacktestDeleteResult`; 400 a target is running; 404 unknown id |

## 5. NOVA Atlas — market data and data jobs

Download validation (NOVA-139): skip-existing plans retry even one missing day in the observed trading
calendar. After requests finish, the worker checks internal gaps within the requested period against
the same calendar as Stored data. Remaining gaps set the job to `failed`, with a per-symbol missing-day
count in `error`; saved candles and finished steps remain. `progressPercent` can be 100 on such a failed
job because all requests finished. The check does not infer unavailable dates before listing or after
the last stored day, or days missing from the observed calendar itself. It never synthesises daily bars.

| Method & path | What it does | Input | Output |
|---|---|---|---|
| `GET /market-data/instruments` | Every instrument that has candles in any timeframe (NOVA-097), with stats: last close, day change %, 52-week high/low, 20-day average volume — from daily bars, or, for a stock with only intraday bars, from its 1m bars rolled up per IST day. Also lot size, sector, indices, `timeframes`, `coverage` (first and last IST date per timeframe, finest first; a stock with `1m` bars also lists `3m 5m 15m 30m 1h` with the `1m` range, D58; stored `3m`–`1h` rows are ignored) and `dataFrom`/`dataTo` (widest over all timeframes). Cached in Atlas: rebuilt when a download completes or is deleted, else every 10 min (`NOVA_INSTRUMENTS_CACHE_SECONDS`). | `exchange` (default `NSE`) | `Instrument[]` |
| `GET /market-data/candles` | OHLCV bars for one symbol and timeframe (`1m 3m 5m 15m 30m 1h 1d`). `1m`/`1d` are stored rows; `3m`–`1h` are rolled up from `1m` at read time (D58): buckets start at 09:15 IST like Kite's (a day's last bucket can be short, e.g. 1h 15:15–15:30), `time` = bucket start. Default range: last 365 days (daily) or 5 days (intraday). Max 3,660 days daily / 60 days intraday. Daily bars carry an IST date, intraday a UTC time. | `symbol`, `timeframe`, `from?`, `to?`, `exchange?` | `Candle[]`; 404 unknown symbol; `[]` if no bars |
| `GET /market-data/universe` | The stock list (every NSE stock after a sync, ~3,900), by symbol. `synced` = Kite knows the stock (its instrument has a token); `newListing` = a sync added it after an earlier sync (an IPO or other new listing). Sent whole, no paging. | `q` (symbol or name contains), `index` (member of), `sector` (exact), `new=true` (new listings only) | `UniverseEntry[]` |
| `GET /market-data/universe/sectors` | Every sector of the stock list with its stock count, A–Z, for picking stocks in bulk (D57). | — | `UniverseSector[] {sector, count}` |
| `POST /market-data/universe` | Adds a stock. Name and sector are stored trimmed. Audit: `instrument.add` ("Added M&M (Mahindra & Mahindra)"). | `UniverseEntryWrite {symbol (NSE style: A–Z, 0–9, &, -), name, sector (≤ 80), indices}` | 201 `UniverseEntry` (with `synced`, `newListing`); 400 bad body, already listed, or an index not in `market_indices` ("Unknown index: …") |
| `PUT /market-data/universe/{symbol}` | Changes name, sector and indices. The symbol itself cannot change. Audit: `instrument.update`. | path + `UniverseEntryWrite` (same symbol) | `UniverseEntry`; 400 (also unknown index); 404 |
| `DELETE /market-data/universe/{symbol}` | Removes a stock from the list. Its downloaded candles and its `instruments` row stay. Audit: `instrument.remove`. | path | 204; 400 while a planned, queued, running or paused job uses it; 404 |
| `POST /market-data/universe/{symbol}/clear-new` | Marks a new listing as seen (`newListing` false). Audit: `instrument.clear_new` (only when it was new). | path | `UniverseEntry`; 404 |
| `GET /market-data/indices` | Every NSE index NOVA knows (`market_indices`), biggest first: name, Kite symbol, members in the stock list, last refresh. | — | `MarketIndex[]` |
| `GET /market-data/coverage` | Stored history per stock (D63, D65): every stock of the stock list plus every index in `market_indices` (`none` until it has candles). Per row: `firstDay`/`lastDay` (whole stored range) and, inside the period, `days`, `missingDays` (trading days between the first and last stored day, clipped to the period, with no bar) and `status` (`complete`, `gaps`, `partial` = starts after or ends before the period, `none`). A later start is not `partial` when a finished download step for that symbol and timeframe asked Kite for a trading day before the first stored day (listed later, D65). Trading days = NIFTY 50 daily bars in the period, else days on which at least 10 stocks have a daily bar (`calendar` says which). | `timeframe` (`1m` or `1d`, default `1d`), `from`/`to` (default: 2020-01-01, or `to` if earlier, to today IST; D69); 400 if from > to | `CoverageList` |
| `GET /market-data/coverage/{symbol}` | The same numbers for one stock or index, plus `missing`: the missing trading days merged into ranges (days next to each other in the calendar are one range). | path + same query | `CoverageDetail`; 404 not in the stock list or indices |
| `POST /market-data/instruments/sync` | Queues an `instrument_sync` data job (D56). The Atlas worker then adds every NSE stock Kite lists (plain symbols and `-BE`/`-BZ`/`-SM`/`-ST`; bonds and SGBs skipped), reads each index's members from NSE (through the broker), fills sectors of new or *Unclassified* stocks from NSE's industry, and refreshes tokens and F&O lot sizes. Stocks added after an earlier completed sync are new listings. A failed NSE file keeps that index's old members and is named in the job `summary`. The worker also queues one each weekday from 08:45 IST once Kite is logged in (none queued, running or completed today; a failed one is retried after 30 min). Audit: `instrument.sync` ("Queued sync with Kite" / "Queued the daily sync with Kite" by System). | — | 202 `DataJob` (`instrument_sync`, `queued`); 400 a sync is already waiting or running |
| `GET /data-jobs` | Background jobs, newest first, paged (`type=` keeps one kind, e.g. the latest `instrument_sync` with `limit=1`): type (`historical_download`, `tick_record`, `archive`, `instrument_sync` — no symbols), status, symbols, timeframe, period, progress %, rows written (stocks synced for a sync), error, summary. | `limit`, `cursor`, `type` | `Page<DataJob>`; 400 unknown type |
| `GET /data-jobs/{id}` | One job. | path | `DataJob`; 404 |
| `POST /data-jobs/plan` | Plans a historical download without running it (D57): a `draft` job with its steps (stock × Kite-sized date chunk: 60 days for 1m … 2,000 for 1d) and a `plan`. With `skip_existing` (default) a step whose candles are already stored (they start and end within 5 days of it, no gap over 5 days and no missing observed trading day) is `skipped`; `overwrite` fetches everything again. The plan gives steps, skipped steps, requests, estimated rows (weekdays × bars per day: 1m 375 … 1d 1), bytes (rows × 80), seconds (0.5 s a request, 1 s in market hours when the pace is `slow`, + 20%), start time (after the jobs ahead), per-stock stored range and warnings (> 20M rows, > 2 h, not synced with Kite, intraday before 2015). The draft expires after 24 h. Audit: `data_job.plan`. | `DataJobPlanRequest {symbols (1–200: stock symbols or index names such as `NIFTY 50`, D62), timeframe, from, to, segment?, mode? (`skip_existing`|`overwrite`)}` | 201 `DataJob` (`draft`, with `plan`, `stepsTotal`, `stepsDone` = skipped, `expiresAt`); 400 bad body, unknown symbol, or a timeframe other than `1m`/`1d` ("Download 1m or 1d; 3m to 1h are built from 1m", D58) |
| `POST /data-jobs/{id}/start` | Starts a planned download: `draft` → `queued`. Audit: `data_job.start`. | path | `DataJob`; 400 not a draft, or the plan expired; 404 |
| `POST /data-jobs/{id}/pause` | Pauses a `queued` or `running` download; a running one stops after its current step (saved steps stay). Audit: `data_job.pause`. | path | `DataJob` (`paused`); 400 not a waiting or running download; 404 |
| `POST /data-jobs/{id}/resume` | `paused` → `queued`; the worker continues from the next unfinished step. Audit: `data_job.resume`. | path | `DataJob`; 400 not paused; 404 |
| `GET /data-jobs/settings`, `PATCH /data-jobs/settings` | Download pace on weekdays 09:15–15:30 IST: `slow` (default, at most 1 historical request a second) or `full` (2/s, the account limit). Audit on change: `download_settings.update` ("Full pace in market hours"). | `DownloadSettingsUpdate {marketHoursMode}` | `DownloadSettings`; 400 bad value |
| `POST /data-jobs` | Queues a historical download at once (stocks or index names, D62) (the pre-plan flow, still used by **New download**): it is planned with `skip_existing` and starts straight away. Audit: `data_job.create` ("Queued 1d download of 2 symbol(s), 2025-01-01 to 2025-12-31 (2 request(s), 0 step(s) already stored)"). | `DataJobCreate {symbols (1–200), timeframe, from, to, segment? (default `equity_delivery`)}` | 201 `DataJob` (`queued`); 400 bad body, unknown symbol, or a timeframe other than `1m`/`1d` |
| `POST /data-jobs/{id}/cancel` | Cancels a `draft`, `queued` or `paused` job at once, or a `running` one: the worker stops before its next step (rows already saved stay). Cancelling a running `tick_record` job stops the recording and turns the recorder switch off. Audit: `data_job.cancel` ("Cancelled 1d download of 2 symbol(s)"). | path | `DataJob` (`cancelled`); 400 "Job is already …" (completed, failed or cancelled); 404 |
| `DELETE /data-jobs/{id}` | Deletes a `draft`, `completed`, `failed` or `cancelled` job and its steps. With `candles=true` (downloads only) it also deletes the `candles` of the job's stocks and timeframe from `from` to `to` (IST days) — including rows other jobs stored there. Open screens get `data_job.deleted`. Audit: `data_job.delete` ("Deleted 1m download of 1 symbol(s) and 91,723 candles"). | path, `candles` (default false) | `DataJobDeleteResult {id, candlesDeleted}`; 400 "Cancel or finish the job first" (queued, running, paused), 400 candles on a non-download; 404 |
| `POST /data-jobs/archive` | Queues an `archive` job for the Atlas worker: every tick received before `before` (IST) moves to Parquet files, a day at a time (files first, then the rows are deleted; an existing file is never overwritten, the job fails instead). The job lists the symbols and the IST dates (`from` = first day, `to` = `before` − 1); progress moves per day, `rowsWritten` = ticks moved; a cancel stops between days. Audit: `data_job.create` ("Queued archive of ticks before 2026-09-01"). | `ArchiveJobCreate {before}` | 201 `DataJob` (`archive`, `queued`); 400 future date or no ticks before it |

---

## 6. Command-line actions (admin, not HTTP)

| Command | Does |
|---|---|
| `python -m nova_core create-admin` | Creates the super-admin user (asks for the password). |
| `python -m nova_broker new-token-key` | Makes the key used to encrypt Kite tokens. |
| `python -m nova_broker recorder` | The always-on recorder (Compose service `tick-recorder`): follows `recorder_settings`, one `tick_record` job per session. |
| `python -m nova_atlas worker` | The data-job worker (Compose service `atlas-worker`): downloads, archives. Syncing, downloads and archives are started from Relay (D55). |
| `python -m nova_db upgrade \| check` | Runs migrations / checks models match the database. |
