# NOVA Stage A — review guide

> A clickable prototype of NOVA Orbit and NOVA Relay. Everything is mock data; nothing is saved
> and nothing reaches Zerodha. Your answers to the checklists below drive the scope freeze (NOVA-022).
> **Round 2** (after your round 1 feedback R1–R4): section 3 lists what changed and what to check.

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

To check the code instead of clicking: `pnpm review:check` (format, lint, types, tests, build).

## 2. Walkthrough

Try each step once in the dark theme and once in light (sun/moon button, top right). For the phone
view, open the browser's dev tools and pick a 360px-wide device; the sidebar becomes a menu.

### NOVA Orbit
1. **Sign in** — any name and password; you land on Strategies.
2. **Strategies** — a card per strategy: status, mode, segment, timeframe, version, and backtest
   stats (runs, best/worst return, win rate, worst drawdown, best net P&L linking to its run).
   Filter by status; sort by updated, best return or most runs.
3. **Strategy detail** — open *VWAP Momentum Intraday*: backtest stats, the rules written out in
   words (no symbols: they are chosen per run), a *Backtests* tab with its runs, and *Versions*.
4. **Edit (visual rules)** — *Edit*: change a rule, add or remove a condition, watch the
   *Spec preview (JSON)* update. *Save draft* only shows a demo message.
5. **New strategy in Python** — *Strategies → New strategy*, switch *Authoring mode* to *Python*.
6. **Run a backtest** — *Run backtest*: version, period, capital, then **Symbols**: search and filter
   (index, sector, F&O only), tick rows or *Select all shown*; the count shows above the list.
   Symbols without data for the period are marked *Partial data*; *Queue backtest* asks to drop them.
   Or choose *A whole index*.
7. **Backtest results** — open *VWAP Intraday v1 Backtest*: symbols tested, metrics, equity curve vs
   NIFTY 50, **results by symbol** (*Show trades* filters the trades), trades with a *Symbol* filter,
   and the charges breakdown per trade.
8. **Unfinished and failed runs** — *Delivery Mean Reversion Test* (running), *SMA Breakout Legacy
   Run* (failed with its error).
9. **Compare** — tick two runs; each shows its symbols; the best value per metric is marked *Best*.
10. **Market data** — the instrument list (search, filters, sector, index, last close, day change,
    52-week range, volume, F&O lot, data range). Click a symbol for its chart and facts; only
    RELIANCE, TCS and INFY have candles (others show *No candles*).

### NOVA Relay
11. **Overview** — counts, the **daily Kite login** prompt, a warning when a rate limit window is
    above 80%, and recent activity.
12. **Broker** — Zerodha profile: API, plan, renewal, API key (last 4 only), redirect URL, static IP,
    session rule, and useful links (open in a new tab).
13. **Broker accounts** — open *Primary Trading Account*: session with *time left*, and its limits.
14. **Rate limits** — per account, endpoint and window (second/minute/day): used vs the NOVA limit,
    broker limit, % used, reset time (IST) or rolling window, *Above 80%* flags. *Edit limits*
    changes the NOVA limit (never above the broker limit); saving is a demo.
15. **Data jobs** and **Audit log** — as in round 1.

### Storybook
16. Browse *Core* and *Trading*; new: *Core/DataTable* selectable stories, *Trading/StrategyCard*.

## 3. Round 2 checklist (changes from your round 1 feedback)

**R1 — Strategy cards**
- [ ] The card shows the stats I want; best net P&L linking to its run is useful.
- [ ] Filter by status and the three sort options are enough.
- [ ] The *Backtests* tab on a strategy lists what I expect.

**R2 — Symbols per backtest**
- [ ] Choosing symbols per run (not per strategy) is right.
- [ ] The picker columns and filters (index, sector, F&O) are the ones I need.
- [ ] The *Partial data* warning and "drop and queue" dialog behave as I expect.
- [ ] Results by symbol and the trade filter answer "which stocks worked".
- [ ] The market data list is better than the old dropdown.

**R3 — Broker limits**
- [ ] Broker limit vs NOVA limit is clear; editing only the NOVA limit is right.
- [ ] Per-second/minute/day usage with reset time is how I want to watch limits.
- [ ] Warn at 80% (or: ______ %).

**R4 — Broker information**
- [ ] The broker page has the facts and links I look up; anything missing: ______
- [ ] Session time left on the account page is useful.

## 4. Round 1 checklist (still open items)

- [ ] Rule builder covers my conditions; visual and Python both stay.
- [ ] Sizing and risk options are enough.
- [ ] Metrics shown first are right; a trade row has what I need.
- [ ] Daily and 5-minute candles are the right starting timeframes.
- [ ] Money, dates and signs read correctly (₹ Indian grouping, IST, +/−); 360px phone works.

**Scope decisions still open** (from `docs/DECISIONS.md` → Pending)
- [ ] Options historical data vendor: ______
- [ ] Family roles and permissions for Phase 1: ______
- [ ] Domain and trademark check for the NOVA name: ______
- [ ] Kite daily reset time for per-day limits (mocks assume 00:00 IST): ______

**Other notes**

______

## 5. Known limits of the prototype (not bugs)
- Nothing is saved: edits, new strategies, queued backtests and limit changes only show a demo message.
- No real runs, downloads, or broker calls; all numbers are fixed mock data dated September 2026
  (the app's "now" is 21 Sep 2026, 12:00 IST, so session times read consistently).
- Only RELIANCE, TCS and INFY have candle data; strategy stats come from two completed runs.
- Lists are not paginated by the API yet (the pagination format is decided at scope freeze, D21).
