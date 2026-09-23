# NOVA Stage A — review guide

> A clickable prototype of NOVA Orbit and NOVA Relay. Everything is mock data; nothing is saved
> and nothing reaches Zerodha. Your answers to the checklist below drive the scope freeze (NOVA-022).

## 1. Start

Prerequisites: Node.js 24, pnpm 12 (`npm i -g pnpm`).

```
cd frontend
pnpm install
pnpm review
```

| What | URL |
|---|---|
| NOVA Orbit (strategies, backtests) | http://localhost:3000 |
| NOVA Relay (broker API, limits, data) | http://localhost:3001 |
| Storybook (every UI component) | http://localhost:6006 |

Stop with `Ctrl+C`. Sign in with **any** username and password (demo sign-in). The yellow bar at the
top of every screen is a reminder that the data is not real.

To check the code instead of clicking: `pnpm review:check` (lint, types, tests, build, format).

## 2. Walkthrough

Try each step once in the dark theme and once in light (sun/moon button, top right). For the phone
view, open the browser's dev tools and pick a 360px-wide device; the sidebar becomes a menu.

### NOVA Orbit
1. **Sign in** — any name and password; you land on Strategies.
2. **Strategies** — three strategies with status (Active, Draft, Archived), mode, segment, version.
3. **Strategy detail** — open *VWAP Momentum Intraday*: the spec is written out in words
   (universe, sizing, risk, entry/exit rules). The *Versions* tab shows its history.
4. **Edit (visual rules)** — *Edit* on the same strategy: change a rule, add or remove a condition,
   watch the *Spec preview (JSON)* update. *Save draft* only shows a demo message.
5. **New strategy in Python** — *Strategies → New strategy*, switch *Authoring mode* to *Python*: a
   code editor with a starter `on_bar` template. Open *Delivery Mean Reversion* to see its code.
6. **Run a backtest** — *Run backtest* on a strategy: pick version, dates (IST), capital, NIFTY 50
   comparison. *Queue backtest* is a demo; it returns to the list.
7. **Backtest results** — open *VWAP Intraday v1 Backtest*: net/gross P&L, charges, CAGR, drawdown,
   Sharpe, win rate, the equity curve against NIFTY 50, and trades. Click a trade's charges amount
   to see brokerage, STT, exchange, SEBI, stamp duty, GST and DP charges.
8. **Unfinished and failed runs** — open *Delivery Mean Reversion Test* (running) and *SMA Breakout
   Legacy Run* (failed with its error).
9. **Compare** — *Compare* on a result (or the sidebar): tick two runs; the best value per metric is
   marked *Best*; the link can be shared.
10. **Market data** — pick RELIANCE/TCS/INFY, daily or 5-minute candles; intraday times are IST.

### NOVA Relay
11. **Overview** — account and session counts, the **daily Kite login** prompt for the expired account
    (the button is a demo), and recent activity.
12. **Broker accounts** — three accounts with session state; open one for its Kite session details.
13. **Rate limits** — per account and endpoint: peak calls per second and calls today vs. the limit,
    with throttling counts.
14. **Data jobs** — historical downloads, tick recording and archive jobs; open the failed one to see
    why, or a running one for its progress.
15. **Audit log** — every action with time (IST), actor and target; filter with *Show*.

### Storybook
16. Browse *Core* and *Trading* components; use the toolbar for theme and 360/768/1440px widths.

## 3. Feedback checklist

Tick what is right, and write what should change next to anything you leave unticked.

**Strategies and editor**
- [ ] The strategy list shows the columns I need.
- [ ] The rule builder covers the conditions I use (indicators, crosses, comparisons).
- [ ] Visual rules and Python both need to stay (or: keep only one).
- [ ] Sizing and risk options are enough (fixed qty, fixed amount, % of equity, stop-loss, target).

**Backtests**
- [ ] The run form asks for the right things (dates, capital, benchmark).
- [ ] These are the first metrics I want to see; nothing important is missing.
- [ ] A trade row has what I need; the charges breakdown matches how I read contract notes.
- [ ] Comparing 2–3 runs side by side is enough.

**Market data**
- [ ] Daily and 5-minute candles are the right starting timeframes.
- [ ] I need these extras soon: ______ (indicators, volume profile, date range…).

**Relay**
- [ ] The daily Kite login prompt is clear; it should / should not block anything when missed.
- [ ] Rate-limit usage is shown the way I want to watch it.
- [ ] The data-job list covers downloads, tick recording and archive the way I expect.
- [ ] The audit log records the actions I care about.

**Everywhere**
- [ ] Money, dates and signs read correctly (₹ Indian grouping, IST, +/−).
- [ ] Works on my phone at 360px; nothing important is hidden.
- [ ] Dark and light themes are both comfortable.

**Scope decisions still open** (from `docs/DECISIONS.md` → Pending)
- [ ] Options historical data vendor: ______
- [ ] Family roles and permissions for Phase 1: ______
- [ ] Domain and trademark check for the NOVA name: ______

**Other notes**

______

## 4. Known limits of the prototype (not bugs)
- Nothing is saved: edits, new strategies and queued backtests only show a demo message.
- No real runs, downloads, or broker calls; all numbers are fixed mock data dated September 2026.
- Lists are not paginated by the API yet (the pagination format is decided at scope freeze, D21).
