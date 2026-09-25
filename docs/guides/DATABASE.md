# NOVA — Database guide (what each table keeps)

> State as of 25 Sep 2026 (migrations `0001`–`0007`, NOVA-076). Source of truth: `backend/libs/nova_db/src/nova_db/models/`.
> One PostgreSQL database with TimescaleDB. Live counters are in Redis; old ticks go to Parquet files.
> Update in the same task as any migration (`AGENTS.md` §7a).

**Conventions (all tables)**
- IDs are text with a prefix (`stg_…`, `run_…`, …). Times are `timestamptz` in **UTC**; `date` columns are Indian calendar dates.
- Money is **integer paise** (`bigint`, columns end in `_paise`); percentages and ratios are `numeric(12,4)`.
- Allowed values of text "enum" columns are enforced by CHECK constraints (list: `nova_db/enums.py`).
- Totals are enforced by the database itself, e.g. `net_pnl_paise = gross_pnl_paise - charges_paise`.
- Change the schema only through an Alembic migration (`python -m nova_db upgrade`; `check` finds drift).

## Map

```
users ─┬─ user_roles ── roles                 (who may sign in)
       ├─ auth_sessions                        (signed-in browsers)
       └─ audit_entries (actor)                (who did what)

broker_accounts ─┬─ broker_sessions            (today's Kite login, token encrypted)
                 └─ rate_limit_rules           (broker vs NOVA limits)
broker_profiles                                (Zerodha setup facts)

strategies ── strategy_versions ── backtest_runs ─┬─ backtest_results
                                                  └─ trades
charge_rates                                   (fees & taxes used for trades)

universe ─ instruments   candles (hypertable)   ticks (hypertable)   data_jobs
```

---

## 1. Users and sign-in

| Table | What it keeps | Key columns |
|---|---|---|
| **users** | People who can sign in. Phase 1: one super-admin, created with `create-admin`. | `id`, `name`, `email` (unique), `password_hash` (never the password), `created_at`, `last_login_at` |
| **roles** | Role names. Seeded with `super_admin`; more roles come with family access later. | `id`, `name` |
| **user_roles** | Which user has which role (many-to-many). Sign-in requires `super_admin`. | `user_id` → users, `role_id` → roles |
| **auth_sessions** | One row per signed-in browser. `id` is the **SHA-256 of the cookie token**, so a database leak does not leak sessions. Deleted on sign-out. | `id`, `user_id`, `created_at`, `expires_at`, `ip`, `user_agent` |

## 2. Zerodha broker

| Table | What it keeps | Key columns |
|---|---|---|
| **broker_accounts** | Each Zerodha account NOVA knows (added in Relay or with `add-account`). | `id`, `broker` (`zerodha`), `label`, `client_id` (unique Zerodha user ID), `enabled`, `created_at` |
| **broker_sessions** | The current Kite login of each account (one row per account). Status is derived: no token = not logged in; past `expires_at` = expired. The access token is **encrypted** with `NOVA_BROKER_TOKEN_KEY`. | `account_id` (PK), `access_token_encrypted`, `logged_in_at`, `expires_at` (next 06:00 IST) |
| **broker_profiles** | Facts about the Zerodha setup shown on Relay's Broker page, refreshed at broker start-up from settings + `data/zerodha.json`. Only the **last 4** characters of the API key are stored; the secret never is. | `broker` (PK), `name`, `api`, `plan`, `subscription_renews_on`, `api_key_last4`, `redirect_url`, `postback_url`, `static_ip`, `session_rule`, `links` (JSON) |
| **rate_limit_rules** | The request limits per account × endpoint (`quote`, `historical`, `orders`, `other`) × window (`second`, `minute`, `day`). `nova_limit` must be > 0 and ≤ `broker_limit` (default 90% of it). Live usage is **not** here: it is in Redis. | PK (`account_id`, `endpoint`, `rate_window`), `broker_limit`, `nova_limit`, `updated_at` |
| **recorder_settings** | The one row (id 1) that switches live tick recording on or off (D54), set with `PUT /broker/recorder`. The always-on recorder reads it every 30 s. Starts off. | `id` (always 1), `enabled`, `symbols` (text[]; empty = every stock synced with Kite), `updated_at` |

## 3. Strategies and backtests

| Table | What it keeps | Key columns |
|---|---|---|
| **strategies** | Each trading idea: name, description, status, and the newest version number. | `id`, `name`, `description`, `status` (`draft`/`active`/`archived`), `latest_version`, `created_at`, `updated_at` |
| **strategy_versions** | Every saved copy of a strategy. **Never changed after insert**, so old backtests stay reproducible. `spec` is the full rule set as JSON (mode, segment, timeframe, entry/exit rules or Python code, sizing, stop-loss, target). | PK (`strategy_id`, `version`), `created_at`, `note`, `spec` (JSONB) |
| **backtest_runs** | Each test run **and the job queue** for the backtest worker (it claims the oldest `queued` row with `FOR UPDATE SKIP LOCKED`). | `id`, `strategy_id` + `strategy_version` → strategy_versions, `name`, `universe` (JSON: chosen symbols or an index), `status` (`queued`/`running`/`completed`/`failed`), `date_from`, `date_to`, `initial_capital_paise`, `benchmark` (`NIFTY 50` or null), `created_at`, `started_at`, `finished_at`, `error` (only when failed) |
| **backtest_results** | The summary of a completed run (one row per run). | `run_id` (PK) → backtest_runs, `gross_pnl_paise`, `charges_paise`, `net_pnl_paise`, `return_percent`, `cagr_percent`, `max_drawdown_percent` (≤ 0), `sharpe`, `win_rate_percent`, `trade_count`, `win_count`, `loss_count`, `equity_curve` (JSON points), `by_symbol` (JSON per-symbol breakdown) |
| **trades** | Every simulated trade of a run with its full charges. DB checks: charges total = sum of parts, net = gross − charges. | `id`, `run_id`, `symbol`, `exchange`, `segment`, `side`, `qty`, `entry_at`, `entry_price_paise`, `exit_at`, `exit_price_paise`, `gross_pnl_paise`, `brokerage_paise`, `stt_paise`, `exchange_txn_paise`, `sebi_fee_paise`, `stamp_duty_paise`, `gst_paise`, `dp_paise`, `charges_total_paise`, `net_pnl_paise` |
| **charge_rates** | Brokerage and statutory rates (NOVA Ledger) per segment from a date on. A rate change = a **new row**, so old trades keep their old rates. Seeded from Zerodha's schedule effective 2024-10-01 for delivery and intraday. | `id`, `segment`, `effective_from` (unique with segment), `rates` (JSON: brokerage %, cap, STT buy/sell %, exchange %, SEBI per crore, stamp %, GST %, DP per sell), `source`, `created_at` |

Deleting a run deletes its result and trades (`ON DELETE CASCADE`); there is no delete in the API in Phase 1.

## 4. Market data (NOVA Atlas)

| Table | What it keeps | Key columns |
|---|---|---|
| **universe** | The stock list, edited through the `/market-data/universe` endpoints (seeded in migration 0006 with 24 NSE stocks). Only listed stocks can be synced and downloaded. Removing one keeps its candles and `instruments` row. | PK (`exchange`, `symbol`), `name`, `sector`, `indices` (text[], each a known index), `created_at`, `updated_at` |
| **instruments** | Master list of shares/contracts (from the `universe` stock list + Kite, by sync). Prices and stats are **not** stored here; the API computes them from candles. | PK (`exchange`, `symbol`), `name`, `segment`, `sector`, `indices` (text[]), `lot_size`, `instrument_token` (Kite's id, unique), `updated_at` |
| **candles** | Price bars (OHLCV). **TimescaleDB hypertable** on `ts`, 30-day chunks. Daily bars are stored at 00:00 IST. DB check: high ≥ open/close ≥ low > 0. | PK (`exchange`, `symbol`, `timeframe`, `ts`), `open_paise`, `high_paise`, `low_paise`, `close_paise`, `volume`; `timeframe` ∈ `1m 3m 5m 15m 30m 1h 1d` |
| **ticks** | Live price updates recorded from Kite's WebSocket during market hours. **Hypertable** on `received_at`, 1-day chunks. Older days are moved to Parquet by `archive-ticks` and then deleted here. | PK (`exchange`, `symbol`, `received_at`), `exchange_ts`, `last_price_paise`, `last_qty`, `volume`, `oi` |
| **data_jobs** | Background data work **and the job queue** for the Atlas worker (it runs `historical_download` jobs only). Types: `historical_download`, `tick_record` (one per recording session, written by the broker's recorder; progress = share of the 09:15–15:30 session), `archive`. Checks: downloads need timeframe + period; completed = 100%; errors only when failed. | `id`, `type`, `status` (`queued`/`running`/`completed`/`failed`/`cancelled`), `exchange`, `segment`, `symbols` (text[]), `timeframe`, `date_from`, `date_to`, `progress_percent`, `rows_written`, `created_at`, `started_at`, `finished_at`, `error` |

## 5. Audit

| Table | What it keeps | Key columns |
|---|---|---|
| **audit_entries** | Permanent log of important actions, written in the same transaction as the change. Actions: `auth.login`, `auth.logout`, `broker.login`, `broker.session_expired`, `broker.rate_limit_update`, `broker.account_create`, `strategy.create`, `strategy.update`, `backtest.run`, `data_job.create`, `data_job.cancel`, `instrument.add`, `instrument.update`, `instrument.remove`, `instrument.sync`, `settings.update`. Failed sign-ins are logged with no actor id. | `id`, `at`, `actor_id` → users (set null if the user is removed), `actor_name`, `action`, `target_type` + `target_id` (both or neither; types: user, broker_account, strategy, backtest, data_job, settings, instrument — its id is the stock symbol), `summary`, `ip` |

## 6. Outside PostgreSQL

| Store | What it keeps |
|---|---|
| **Redis** (`nova:rl:*` keys) | Live rate-limit usage per account × endpoint: rolling logs for second/minute windows, a counter per day period, daily peaks (`nova:rl:peak:*`) and throttle counts. Lost on Redis reset; only today's usage matters. |
| **Parquet tick archive** (`tick-archive` volume) | Old ticks, one file per day and symbol: `date=YYYY-MM-DD/symbol=XXX/ticks.parquet`. |
| **alembic_version** (table) | The migration the database is on (currently `0007`). Managed by Alembic only. |
