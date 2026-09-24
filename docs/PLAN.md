# NOVA — Plan

## Phases (whole platform)
| Phase | Scope | Status |
|---|---|---|
| 1 | Strategy building + backtesting (NSE, all segments by design) | **current** |
| 2 | Paper trading (live data, fake money) | later |
| 3 | Live trading with risk limits + kill switch (NOVA Launch) | later |
| 4 | Alerts, news (NOVA Beacon, NOVA Pulse) | later |
| 5 | More assets: mutual funds, IPO, gold, currency, crypto; more countries | later |

## Phase 1 — stages
**Stage A — Prototype (done, scope frozen 2026-09-23, D31).** Frontend only, static mocks. Output: clickable prototype for review, run locally.
**Stage B — Real backend (current).** Builds the backend behind the frozen screens and contracts. A scope change needs a decision entry and a task.

### Stage A order
1. Repo, tooling, theme tokens, Storybook (NOVA-001 → 003)
2. Contracts, mocks, services layer (NOVA-004 → 006)
3. NOVA UI library: `ui-core`, then `ui-trading` (NOVA-007 → 012)
4. Screens: login, NOVA Orbit, NOVA Relay (NOVA-013 → 020)
5. Review build, feedback (NOVA-021)
6. Review round 1 changes (NOVA-030 → 041, below), then scope freeze (NOVA-022)

### Review round 1 — requirement changes (Owner feedback, 2026-09-23)
**Orbit — strategies list (R1).** Cards instead of a table. Each card: name, status, mode, segment,
timeframe, version, updated, and backtest stats: runs total / completed / failed / in progress,
last run date, best and worst return %, win-rate range (min–max), worst drawdown, best net P&L
(links to that run). Filter by status, sort by updated / best return / runs. Stats come from a
backend summary (`StrategyStats`), never computed in the screen. Strategy detail gets the same
stats and a *Backtests* tab listing that strategy's runs.

**Orbit — symbols (R2).** A strategy no longer holds symbols: it is rules only (segment, exchange,
timeframe, sizing, risk, entry/exit or code). Symbols are chosen when a backtest is queued, so one
strategy can be tested on different baskets. The run stores its universe (symbols, or a whole index).
- Picker = searchable, filterable list with a checkbox per row and "select all shown": symbol,
  name, sector, index membership, last close, day change %, 52-week range, avg daily volume,
  F&O lot size, data available from–to. Filters: index, sector, F&O only.
- A symbol whose data does not cover the chosen period is flagged; queueing asks to drop it.
- Selected count is always visible; at least 1 symbol required.
- Run list, result page and compare show the universe (e.g. "12 symbols" / "NIFTY BANK").
- Results add a per-symbol breakdown (trades, win rate, net P&L) and a symbol filter on trades.
- Market data page uses the same instrument list (search + info) instead of a plain select.

**Relay — broker limits (R3).** Broker limits are set by Zerodha and cannot be raised from NOVA.
NOVA keeps its own *safety limit* per endpoint and window (≤ broker limit) and throttles to it.
- Per endpoint (quote, historical, orders, other) and window (per second / per minute / per day):
  broker limit, NOVA limit, used (peak for second/minute, count for day), % used, and when the
  counter resets (daily reset time in IST; per-second/minute windows are rolling).
- Kite v3 values (docs, checked 2026-09-23): quote 1/s, historical 3/s, orders 10/s + 400/min +
  5,000/day, other 10/s; max 25 modifications per order. Daily reset time is unconfirmed; mocks
  assume 00:00 IST and Stage B must verify.
- *Edit limits* (per account + endpoint): change the NOVA limit only, validated ≤ broker limit,
  recorded in the audit log. Stage A shows a demo toast.
- Warning when any window passes 80% of the NOVA limit (rate-limit page and overview).

**Relay — broker information (R4).** A *Broker* page per broker: API (Kite Connect v3), plan,
subscription renewal date, API key (last 4 characters only, never the secret), redirect and postback
URLs, registered static IP (SEBI, needed from Phase 3), session rule (daily login; token valid until
06:00 IST next day), and useful links opening in a new tab: API docs, rate limits, developer
console, forum, charges, Python client. Links come from data, not code. Account detail shows its
limits summary and the time left on its session.
Mock session expiry corrected to 06:00 IST the next day (was 00:00 IST).

### Scope freeze (NOVA-022, 2026-09-23)
Owner reviewed round 2 (R1–R4 and the open round 1 items) and accepted it with no changes. The screens,
flows and contracts on `main` after NOVA-042 are the Phase 1 scope (D31). Open items were closed in
D32–D35 (pagination, backend tooling, contract parity, Kite access); still pending: see `DECISIONS.md`.

### Stage B order
Database design → NOVA Core (gateway + auth) → Broker service (Kite login, tokens, rate limiter) → NOVA Atlas (data download, tick recorder, archive) → NOVA Ledger (charges engine) → Strategy service → Backtest engine → switch screens from mock to real, one at a time.

| Step | Tasks | What exists after |
|---|---|---|
| 1. Foundation | 043 backend skeleton · 044 contract parity · 045–046 pagination (frontend) | Compose stack, checks, contracts checked on both sides |
| 2. Database | 047 schema v1 + migrations | Domain tables behind the contracts, candles as a hypertable (later tasks add their own tables by migration) |
| 3. NOVA Core | 048 auth + gateway | Super-admin sign-in, `/me`, routing to services, audit writes |
| 4. Broker | 049 Kite login + tokens · 050 rate limiter | Daily Kite login, encrypted tokens, limits enforced |
| 5. NOVA Atlas | 051 instrument sync + candle downloads · 061 market-data endpoints · 052 tick recorder + archive | Market data from Kite; ticks recorded from go-live |
| 6. NOVA Ledger | 053 charges engine | Charges per trade from dated rate tables |
| 7. Strategies | 054 strategy service | Strategy CRUD, versions, stats summary |
| 8. Backtests | 055 engine v1 (delivery) · 056 intraday · 057 Python mode | Real backtest runs, results, trades |
| 9. Real mode | 058 Relay + login · 059 Orbit | Screens on the real API (`VITE_DATA_MODE=real`) |

Futures and options engines come after 059; options wait for the data vendor decision.

### Segment order for engines (Stage B)
Equity delivery → equity intraday → futures → options. The data model supports all four from day one.

## Key constraints
- Kite historical data minimum interval is 1 minute. Second/tick data is recorded from the live WebSocket from go-live onward.
- Expired option contracts are not in Kite historical data; options backtests need an authorised data vendor (decision pending).
- SEBI retail algo framework applies from Phase 3: static IP, daily Kite login, exchange algo ID, kill switch.
- Single super-admin user in Phase 1; `users`/`roles` tables exist so family roles can be added later.
