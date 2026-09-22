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
5. Review build, feedback, scope freeze (NOVA-021 → 022)

### Stage B order (planned after freeze)
Database design → NOVA Core (gateway + auth) → Broker service (Kite login, tokens, rate limiter) → NOVA Atlas (data download, tick recorder, archive) → NOVA Ledger (charges engine) → Strategy service → Backtest engine → switch screens from mock to real, one at a time.

### Segment order for engines (Stage B)
Equity delivery → equity intraday → futures → options. The data model supports all four from day one.

## Key constraints
- Kite historical data minimum interval is 1 minute. Second/tick data is recorded from the live WebSocket from go-live onward.
- Expired option contracts are not in Kite historical data; options backtests need an authorised data vendor (decision pending).
- SEBI retail algo framework applies from Phase 3: static IP, daily Kite login, exchange algo ID, kill switch.
- Single super-admin user in Phase 1; `users`/`roles` tables exist so family roles can be added later.
