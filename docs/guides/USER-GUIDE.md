# NOVA — User guide (what works today)

> Written for anyone in the family, no technical knowledge needed.
> State as of **25 Sep 2026** (Stage B, tasks up to NOVA-070). NOVA **never places real orders**: it only
> tests trading ideas on past prices and manages the connection to Zerodha.
> *Maintainers: update this guide in the same task as any screen change (`AGENTS.md` §7a).*

---

## 1. What NOVA is, in one minute

NOVA has two websites (we call them "apps"):

| App | Think of it as… | What you do there |
|---|---|---|
| **NOVA Orbit** | A *practice lab* for trading ideas | Write a trading idea as rules ("buy when…, sell when…"), test it on past prices, see if it would have made money |
| **NOVA Relay** | The *control room* for the Zerodha connection | Log in to Zerodha (Kite) once a day, watch how many requests we send to Zerodha, see data downloads and a history of who did what |

A few words you will see everywhere:

| Word | Meaning |
|---|---|
| **Strategy** | A trading idea written as rules. Example: "Buy when the price goes above its 20-day average; sell when it drops below." |
| **Version** | Every time you save a strategy, NOVA keeps a new copy (v1, v2, v3…). Old copies are never changed, so old test results always stay true. |
| **Backtest** | "What would have happened if I had used this strategy in the past?" NOVA replays past prices and pretends to trade. |
| **Symbol** | The short name of a share on the stock exchange, e.g. `RELIANCE`, `TCS`, `INFY`. |
| **Candle** | One bar on a price chart: the opening, highest, lowest and closing price for a day (or for 5 minutes, etc.). |
| **P&L** | Profit and Loss. **Gross** = before costs, **Charges** = brokerage, taxes and fees, **Net** = what you really keep. |
| **Kite** | Zerodha's system. NOVA talks to Kite to get prices. It needs a fresh login every day. |

Money is shown the Indian way (`₹5,00,000`), times in Indian time (IST), and profit shows `+₹98,244`,
loss shows `−₹14,236`.

---

## 2. Two ways to run it: Demo and Real

| | **Demo mode** | **Real mode** |
|---|---|---|
| Data | Made-up sample data | Your real database |
| Saving | Nothing is saved (you see a "demo" message) | Everything is saved |
| How to tell | A **yellow bar** at the top of every screen says the data is not real | No yellow bar |
| Sign-in | Any name and any password | Your email and password (the super-admin account) |

Whoever set up the computer starts it. For reference (run inside the `frontend` folder):

- Demo: `pnpm review` → Orbit on http://localhost:3000, Relay on http://localhost:3001
- Real: start the backend (`docker compose up -d` in the main folder), then
  `pnpm --filter nova-relay dev:real` and `pnpm --filter nova-orbit dev:real`

---

## 3. Things that look the same on every screen

- **Menu on the left** — jumps between pages. On a phone it folds into a ☰ menu button at the top.
- **Sun / moon button** (top right) — switches between dark and light colours.
- **Sign out button** (top right) — ends your session. If you are idle too long, NOVA signs you out and
  shows the sign-in page again.
- **Load more** buttons at the bottom of long lists — show the next batch of rows.
- Every page works on a phone. Wide tables turn into stacked "cards" on small screens.

---

## 4. NOVA Orbit, step by step

### Step 1 — Sign in
1. Open Orbit (http://localhost:3000).
2. Type your **email** and **password** (demo: anything) and press **Sign in**.
3. You land on the **Strategies** page.

### Step 2 — Look at your strategies
Each strategy is a **card**. A card shows:
- its **status**: *Draft* (still working on it), *Active* (in use), *Archived* (put away);
- how it is built (*Visual rules* or *Python*), the type of trading (delivery = hold for days, intraday = same day),
  and the candle size (1 day, 5 minutes…);
- test results so far: number of runs, best and worst return, win rate, worst drop, and best net profit
  (click it to open that test).

Use **Status** to show only drafts/active/archived, and **Sort by** to order by *Recently updated*,
*Best return* or *Most runs*.

### Step 3 — Open one strategy
Click a card. You see:
- the **rules written in plain words** (e.g. "Enter when Close crosses above SMA(20)");
- a **Backtests** tab: every test run of this strategy;
- a **Versions** tab: every saved copy with its date and note.

Buttons: **Edit** and **Run backtest**.

### Step 4 — Create or edit a strategy (visual rules — no coding)
Go to **Strategies → New strategy** (or **Edit** on an existing one).

1. **Basics** — give it a **Name** and **Description**, choose **Segment** (delivery or intraday),
   **Exchange** (NSE) and **Timeframe** (candle size, e.g. 1 day or 5 minutes).
2. **Entry rules** — *when to buy*. Each rule is: **Left** thing · comparison · **Right** thing.
   - A "thing" can be a **Price** (Open, High, Low, Close, Volume), an **Indicator** (SMA, EMA, RSI, MACD,
     VWAP, ATR, Bollinger upper/lower, with a period like 20), or a plain **Number**.
   - Comparisons: *crosses above*, *crosses below*, *greater than*, *less than*, *equal*, etc.
   - Choose **All conditions** (every rule must be true) or **Any condition** (one is enough).
   - Add rules with **Add condition**; remove one with its remove button.
3. **Exit rules** — *when to sell*, built the same way.
4. **Sizing and risk** — how much to buy each time: **Fixed quantity** (e.g. 10 shares),
   **Fixed amount** (e.g. ₹50,000) or a **Percentage** of your money; optional **Stop-loss** % (sell if it
   falls this much) and **Target** % (sell once it gains this much).
5. The **Spec preview (JSON)** box shows the same rules in computer form. You can ignore it.
6. Press **Save draft**.
   - New strategy → it is created as version 1 and opens.
   - Existing strategy → a **new version** is saved (the old one stays untouched).

### Step 4b — Or write the strategy in Python (for people who code)
Switch **Authoring mode** to **Python**. A ready template appears: a `Strategy` class whose `on_bar`
function returns `"enter"`, `"exit"` or nothing for each candle. For safety, the code cannot import
libraries, open files or reach the internet; it runs in a locked box with time and memory limits.

### Step 5 — Run a backtest
Press **Run backtest** (on a strategy, or **Backtests → Run backtest**).

1. **Strategy** and **Version** — which idea, and which saved copy of it.
2. **Run name** — any name you will recognise later.
3. **Period and capital** — **From** and **To** dates, **Initial capital** (pretend starting money, in ₹),
   and tick **Compare with NIFTY 50** to see how the market itself did.
4. **Symbols → Test on**:
   - **Chosen symbols**: search by name, filter by index, sector or "F&O only", tick rows or press
     *Select all shown*. The count of chosen shares shows above the list.
   - **A whole index**: e.g. all NIFTY 50 shares.
5. Press **Queue backtest**. If some shares have no price data for your dates, NOVA marks them
   *Partial data* and asks whether to **Drop and queue** without them.
6. The run goes into a waiting line: status *Queued* → *Running* → *Completed* (or *Failed* with the reason).

### Step 6 — Read the results
Open a run from **Backtests**. You see:
- **Metrics**: Net P&L, Gross P&L, Charges, CAGR (average yearly growth), Max drawdown (biggest fall from a
  high point), Sharpe (profit vs. risk; higher is better), Win rate, number of Trades.
- **Equity curve**: a line of your pretend money over time, next to NIFTY 50 if you asked for it.
- **Results by symbol**: which shares made or lost money. **Show trades** filters the trade list to that share.
- **Trades**: every pretend buy and sell, with price, quantity, profit and a **charges breakdown**
  (brokerage, STT, exchange fee, SEBI fee, stamp duty, GST, DP charge) — calculated with Zerodha's real rates.

How the pretend trading works (so results are fair): a rule is checked when a candle closes and the trade
happens at the next candle's opening price, so NOVA never "peeks into the future". Intraday trades are
closed at 15:20 like Zerodha MIS.

### Step 7 — Compare runs
Go to **Compare**, tick two or more runs. NOVA shows their metrics side by side (the best value in each row
is marked **Best**) and their equity curves together.

### Step 8 — Look at market data
Go to **Market data**. A table lists every share we have prices for: sector, index, last close, day change,
52-week range, average volume, F&O lot size, and the dates we have data for. Search or filter, then click a
symbol to see its **price chart** (pick the **Timeframe**) and key facts.

---

## 5. NOVA Relay, step by step

### Step 1 — Sign in
Open Relay (http://localhost:3001) and sign in the same way as Orbit. You land on **Overview**.

### Step 2 — Overview (check this every morning)
- Counts: **Accounts**, **Active sessions**, **Need login**, **Disabled**.
- A **daily Kite login** reminder for any account whose login has expired.
- A warning if we are using more than **80%** of any Zerodha request limit.
- **Recent activity**: the latest entries from the audit log.

### Step 3 — Do the daily Kite login
Zerodha requires a fresh login every day: a login is valid until **6:00 AM the next morning** (IST).
1. On **Overview** or **Broker accounts → an account**, press **Log in to Kite**.
2. Zerodha's own login page opens. Log in there (NOVA never sees your Zerodha password).
3. You come back to the account page with a message: **Kite connected** ✓ or **Kite login failed**
   (the audit log says why, e.g. you logged in with a different Zerodha ID).

### Step 4 — Broker accounts
A list of Zerodha accounts: name, client ID, session status and when it expires.
Open one to see **Logged in**, **Expires**, **Time left**, and its request limits.

To add an account, press **Add account**, fill in **Account name** (any name, e.g. *Main*) and
**Zerodha client ID** (your Zerodha user ID, e.g. *AB1234*), then press **Add account** again.
The new account starts as **Not logged in**: open it and do the daily Kite login (Step 3).
Each client ID can be added only once. Adding an account is written in the audit log.

### Step 5 — Broker
Facts about our Zerodha setup: API type, plan, renewal date, API key (**only the last 4 characters**
are ever shown), redirect URL, static IP, the session rule, and **Useful links** to Zerodha pages.

### Step 6 — Rate limits
Zerodha only allows a certain number of requests per second, per minute and per day. For each account and
each kind of request (quotes, historical data, orders, other) you see:
- **Broker limit** — Zerodha's maximum;
- **NOVA limit** — our own, safer maximum (by default 90% of Zerodha's);
- **Used** now, **% used**, and when the daily count **resets**;
- an **Above 80%** flag when we are close to the limit.

Press **Edit limits** to change the NOVA limit. It can never be set above Zerodha's limit. Every change is
written in the audit log.

### Step 7 — Data jobs
Background work that fills our price database: **historical downloads** (past candles from Zerodha),
**tick recording** (live prices during market hours) and **archiving** (moving old live prices to files).
Each job shows status, symbols, period, progress % and rows written. Open one for details or the error if it
failed. (Jobs are started by the admin from the command line for now.)

### Step 8 — Audit log
A permanent diary of important actions: sign-ins (also failed ones), Kite logins, session expiries, broker
accounts added, limit changes, strategies created or saved, backtests queued. Each line shows time, who, what, on what, and a
summary. Use **Show** to filter by kind of activity and **Load older entries** to go back in time.

---

## 6. What is NOT there yet (not bugs)

- **No real buying or selling.** Placing orders is a later phase (NOVA Launch).
- Broker accounts cannot be renamed, disabled or removed from the screen yet. There are no buttons yet to
  start data downloads or cancel jobs either: the admin does these from the command line. The *Cancel* button on a data job is a demo.
- Strategies cannot be deleted (old test results depend on them); set them to *Archived* instead.
- Backtests are for **shares only** (delivery and intraday); futures and options come later.
- The market-data chart shows the last year of daily candles (or the last 5 days of intraday) by default.
- Only one person (the super-admin) can sign in for now; family roles come later.

---

## 7. Quick "what do I do if…"

| Problem | What to do |
|---|---|
| Yellow bar at the top | You are in demo mode: nothing you do is saved. |
| Backtest says *Log in to Kite in Relay first* or data is missing | Do the daily Kite login in Relay (Step 3), then ask the admin to download data. |
| Backtest *Failed* | Open it: the red box explains why (e.g. a Python error or missing data). |
| Signed out suddenly | Your session expired. Sign in again. |
| Rate-limit warning above 80% | Wait for the reset time shown, or lower how much you download at once. |
