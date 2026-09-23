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
**Stage A — Prototype (current).** Frontend only, static mocks. Output: clickable prototype for review, run locally.
**Stage B — Real backend.** Starts only after Stage A feedback is applied and scope is frozen (NOVA-022).

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

### Stage B order (planned after freeze)
Database design → NOVA Core (gateway + auth) → Broker service (Kite login, tokens, rate limiter) → NOVA Atlas (data download, tick recorder, archive) → NOVA Ledger (charges engine) → Strategy service → Backtest engine → switch screens from mock to real, one at a time.

### Segment order for engines (Stage B)
Equity delivery → equity intraday → futures → options. The data model supports all four from day one.

## Key constraints
- Kite historical data minimum interval is 1 minute. Second/tick data is recorded from the live WebSocket from go-live onward.
- Expired option contracts are not in Kite historical data; options backtests need an authorised data vendor (decision pending).
- SEBI retail algo framework applies from Phase 3: static IP, daily Kite login, exchange algo ID, kill switch.
- Single super-admin user in Phase 1; `users`/`roles` tables exist so family roles can be added later.
