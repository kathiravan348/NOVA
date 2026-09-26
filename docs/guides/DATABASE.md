# NOVA — Database guide (what each table keeps)

> State as of 26 Sep 2026 (migrations `0001`–`0012`, NOVA-098). Source of truth: `backend/libs/nova_db/src/nova_db/models/`.
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
                 ├─ broker_kite_apps           (own Kite app, secret sealed by passphrase)
                 └─ rate_limit_rules           (broker vs NOVA limits)
broker_profiles                                (Zerodha setup facts)

strategies ── strategy_versions ── backtest_runs ─┬─ backtest_results
                                                  └─ trades
charge_rates                                   (fees & taxes used for trades)

universe ─ instruments   market_indices   candles (hypertable)   ticks (hypertable)   data_jobs ─ data_job_steps   download_settings
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
| **broker_kite_apps** | Each account's own Kite Connect app (D55; one per family member). The API key is plain (it is public in the login URL); the **API secret is sealed with the Owner's passphrase** (scrypt + AES-256-GCM, account id bound in), so neither a database copy nor `.env` reveals it. Key and secret are set together. Migration 0008 copied the old profile's plan/renewal/postback/static IP into a row per existing account. | `account_id` (PK) → broker_accounts (cascade), `api_key`, `api_secret_sealed` (version, salt, nonce, ciphertext), `plan`, `subscription_renews_on`, `postback_url`, `static_ip`, `updated_at` |
| **broker_profiles** | Zerodha facts shown on Relay's Broker page, refreshed at broker start-up from `data/zerodha.json`. | `broker` (PK), `name`, `api`, `session_rule`, `links` (JSON) |
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
| **universe** | The stock list, edited through the `/market-data/universe` endpoints (seeded in migration 0006 with 24 NSE stocks). Only listed stocks can be synced and downloaded. Removing one keeps its candles and `instruments` row. | PK (`exchange`, `symbol`), `name`, `sector`, `indices` (text[] of `market_indices` names, checked by the API), `new_listing` (added by a sync after an earlier sync: e.g. an IPO), `created_at`, `updated_at` |
| **market_indices** | NSE indices (migration 0009 seeds 19: NIFTY 50, NEXT 50, 100, 200, 500, MIDCAP 100, SMLCAP 100 and sector indices). Kite gives each one's token; NSE's constituent file gives its members. | PK `name` (= Kite trading symbol), `kite_symbol` (unique), `constituents_file` (e.g. `ind_nifty50list.csv`), `instrument_token`, `member_count`, `updated_at` |
| **instruments** | Master list of shares/contracts (from the `universe` stock list + Kite, by sync). Prices and stats are **not** stored here; the API computes them from candles. | PK (`exchange`, `symbol`), `name`, `segment`, `sector`, `indices` (text[]), `lot_size`, `instrument_token` (Kite's id, unique), `updated_at` |
| **candles** | Price bars (OHLCV). **TimescaleDB hypertable** on `ts`, 30-day chunks. Daily bars are stored at 00:00 IST. DB check: high ≥ open/close ≥ low > 0. | PK (`exchange`, `symbol`, `timeframe`, `ts`), `open_paise`, `high_paise`, `low_paise`, `close_paise`, `volume`; `timeframe` ∈ `1m 3m 5m 15m 30m 1h 1d` |
| **ticks** | Live price updates recorded from Kite's WebSocket during market hours. **Hypertable** on `received_at`, 1-day chunks. Older days are moved to Parquet by `archive-ticks` and then deleted here. | PK (`exchange`, `symbol`, `received_at`), `exchange_ts`, `last_price_paise`, `last_qty`, `volume`, `oi` |
| **data_jobs** | Background data work **and the job queue** for the Atlas worker (it runs `historical_download` and `archive` jobs). Types: `historical_download`, `tick_record` (one per recording session, written by the broker's recorder; progress = share of the 09:15–15:30 session), `archive`, `instrument_sync` (no symbols). Checks: downloads need timeframe + period; symbols required except for `instrument_sync`; `summary` ≤ 500 chars; completed = 100%; errors only when failed. Trigger `data_jobs_notify` (0010, deletes since 0012) sends `pg_notify('nova_events', {"type":"data_job.updated","id":…})` after every insert or update and `data_job.deleted` after a delete; NOVA Core listens and pushes the job to open WebSockets. | `id`, `type`, `status` (`draft` planned, not started / `queued` / `running` / `completed` / `failed` / `cancelled` / `paused` stopped between steps), `exchange`, `segment`, `symbols` (text[]), `timeframe`, `date_from`, `date_to`, `progress_percent`, `rows_written`, `created_at`, `started_at`, `finished_at`, `error`, `summary` (one result line), `mode` (`skip_existing`/`overwrite`, downloads only), `plan` (jsonb `DataJobPlan`, shown before Start), `expires_at` (drafts only; required on drafts), `steps_total`, `steps_done` (0 ≤ done ≤ total; kept in step with `data_job_steps`) |
| **data_job_steps** | The steps of a planned download (D57): one Kite-sized request per stock × date chunk, saved as it finishes, so Pause, Resume and a worker restart continue from the next `pending` step. Removed with their job. | PK (`job_id` → data_jobs, cascade; `seq`), `symbol`, `start_at`, `end_at` (UTC, start < end), `status` (`pending`/`done`/`skipped`; `finished_at` set exactly when not pending), `rows_written`, `finished_at`; index (`job_id`, `status`, `seq`) |
| **download_settings** | The one row (id 1) of download settings (D57): pace on weekdays 09:15–15:30 IST. Starts `slow`. | `id` (always 1), `market_hours_mode` (`slow` ≤ 1 request/s, `full` 2/s), `updated_at`, `updated_by` → users (set null) |

## 5. Audit

| Table | What it keeps | Key columns |
|---|---|---|
| **audit_entries** | Permanent log of important actions, written in the same transaction as the change. Actions: `auth.login`, `auth.logout`, `broker.login`, `broker.session_expired`, `broker.rate_limit_update`, `broker.account_create`, `broker.kite_app_update`, `strategy.create`, `strategy.update`, `backtest.run`, `data_job.create`, `data_job.cancel`, `data_job.plan`, `data_job.start`, `data_job.pause`, `data_job.resume`, `data_job.delete`, `instrument.add`, `instrument.update`, `instrument.remove`, `instrument.sync`, `instrument.clear_new`, `settings.update`, `download_settings.update`. Failed sign-ins are logged with no actor id. | `id`, `at`, `actor_id` → users (set null if the user is removed), `actor_name`, `action`, `target_type` + `target_id` (both or neither; types: user, broker_account, strategy, backtest, data_job, settings, instrument — its id is the stock symbol), `summary`, `ip` |

## 6. Outside PostgreSQL

| Store | What it keeps |
|---|---|
| **Redis** (`nova:rl:*` keys) | Live rate-limit usage per account × endpoint: rolling logs for second/minute windows, a counter per day period, daily peaks (`nova:rl:peak:*`) and throttle counts. Lost on Redis reset; only today's usage matters. |
| **Parquet tick archive** (`tick-archive` volume) | Old ticks, one file per day and symbol: `date=YYYY-MM-DD/symbol=XXX/ticks.parquet`. |
| **alembic_version** (table) | The migration the database is on (currently `0012`). Managed by Alembic only. |
| **Connections** | Postgres allows 100 connections (`compose.yaml` starts it with `max_connections=100`; the image's own tuning would give 25). Each service process keeps at most 2 idle connections and opens at most 8 (`create_db_engine`). |
