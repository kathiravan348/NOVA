# NOVA — Decisions log

> Newest last. One short entry per decision. Only Claude or the Owner adds entries.

| # | Date | Decision | Why |
|---|---|---|---|
| D1 | 2026-09-22 | Name: NOVA (Networked Order & Value Analytics); products Orbit, Relay, Core, Atlas, Ledger, UI, Style | Owner choice; names in `brand.config.ts` only |
| D2 | 2026-09-22 | Broker: Zerodha Kite Connect (paid plan, one key in Phase 1) | Paid plan includes live + historical data |
| D3 | 2026-09-22 | Phase 1 = strategy building + backtesting only | Prove strategies before any real money |
| D4 | 2026-09-22 | UI first with static mocks (Stage A), backend after scope freeze (Stage B) | Get feedback on a visible workflow first |
| D5 | 2026-09-22 | Frontend: React + TS + Vite monorepo; backend: Python + FastAPI | Best libraries for each side |
| D6 | 2026-09-22 | Light microservices: core, broker, atlas, ledger, strategy, backtest | Enough separation without heavy integration cost |
| D7 | 2026-09-22 | UI library in the same monorepo; `ui-core` generic and publish-ready, `ui-trading` separate | Reuse in future projects |
| D8 | 2026-09-22 | Design system NOVA Style: dark navy default + light theme, IBM Plex Sans/Mono | Approved theme preview |
| D9 | 2026-09-22 | Strategies: visual builder and Python, both produce one Strategy Spec | One engine, one results format |
| D10 | 2026-09-22 | All segments designed from day one; engines built delivery → intraday → futures → options | Avoid redesign without multiplying bugs |
| D11 | 2026-09-22 | Finest data: 1-minute historical from Kite; ticks recorded live from go-live | Kite has no historical second/tick data |
| D12 | 2026-09-22 | Single super-admin in Phase 1; roles tables exist for later | Roles not finalised |
| D13 | 2026-09-22 | Mobile responsive from 360px | Family will use phones |
| D14 | 2026-09-22 | Claude plans and reviews (may fix during review); Gemini implements; task status is the lock | Parallel work without collisions |

## Pending
- Options historical data vendor (needed before options backtests).
- Family roles and permissions.
- Domain and trademark check for NOVA naming.
