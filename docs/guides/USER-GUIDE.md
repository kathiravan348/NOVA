# NOVA — User guide (what works today)

> Written for anyone in the family, no technical knowledge needed.
> State as of **26 Sep 2026** (Stage B, tasks up to NOVA-096). NOVA **never places real orders**: it only
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
   - A "thing" can be a **Price** (Open, High, Low, Close, Volume), an **Indicator**, or a plain **Number**.
   - An *indicator* is a number calculated from past prices. The **Indicator** list has 38, in groups.
     Choosing one shows its own settings (for example MACD: **Fast**, **Slow**, **Signal**), already filled
     with the usual values. You can change them.
     - **Trend**: moving averages (SMA, EMA, WMA), MACD; **SuperTrend** (a line under the price in an
       up-trend, above it in a down-trend); **ADX** (how strong a trend is, whatever its direction) with
       **+DI / −DI** (buying vs selling pressure); **Parabolic SAR** (a trailing stop that follows the trend).
     - **Momentum**: RSI; **Stochastic** (where the close sits in the recent high–low range); **CCI** (how far
       the price is from its average); **Williams %R** (like Stochastic, from 0 down to −100); rate of change %.
     - **Volatility**: ATR (the average daily range), Bollinger bands; **Keltner** bands (average ± ATR);
       **Highest high / Lowest low** of the last few candles (Donchian).
     - **Volume**: VWAP; **OBV** (volume added on up days, taken away on down days); **MFI** (like RSI but
       weighted by volume); Volume SMA.
     - **Levels (previous day)**: yesterday's high, low and close, and the **pivot** levels traders compute
       from them (Pivot, R1/R2 above it, S1/S2 below it).
   - **Bars ago** looks back in time: 0 is the current candle, 1 the one before. Example: *Close greater
     than High, 1 bar ago* means "today's close beats yesterday's high".
   - Comparisons: *crosses above*, *crosses below*, *greater than*, *less than*, *equal*, etc.
   - Choose **All conditions** (every rule must be true) or **Any condition** (one is enough).
   - Add rules with **Add condition**; remove one with its remove button.
3. **Exit rules** — *when to sell*, built the same way.
4. **Sizing and risk** — how much to buy each time: **Fixed quantity** (e.g. 10 shares),
   **Fixed amount** (e.g. ₹50,000) or a **Percentage** of your money; optional **Stop-loss** % (sell if it
   falls this much) and **Target** % (sell once it gains this much).
   - **Cost averaging** (optional switch): while you hold a stock, buy the same amount again each time the
     price falls by **Add every (% fall)** below your last buy, at most **Max extra buys** times. Example: 5%
     and 3 → buy at ₹100, again at ₹95, ₹90.25 and ₹85.74. Stop-loss and target then count from the
     **average** buy price. In the results the whole position is **one trade**: all the shares, at the
     average price.
5. The **Spec preview (JSON)** box shows the same rules in computer form. You can ignore it.
6. Press **Save draft**.
   - New strategy → it is created as version 1 and opens.
   - Existing strategy → a **new version** is saved (the old one stays untouched).

### Step 4b — Or write the strategy in Python (for people who code)
Switch **Authoring mode** to **Python**. A ready template appears: a `Strategy` class whose `on_bar`
function returns `"enter"`, `"exit"` or nothing for each candle. For safety, the code cannot import
libraries, open files or reach the internet; it runs in a locked box with time and memory limits.

Every indicator from the visual list works here too, written as `ctx.` plus its short name and its
settings in the same order as the editor shows them: `ctx.rsi(14)`, `ctx.supertrend(10, 3)`,
`ctx.macd_signal(12, 26, 9)` (or by name: `ctx.macd_signal(fast=12, slow=26, signal=9)`). Add `ago=1` for
the value one candle earlier. The settings must be plain numbers typed in the code, not names you
calculate. The answer is empty (`None`) until there are enough candles.

### Step 5 — Run a backtest
Press **Run backtest** (on a strategy, or **Backtests → Run backtest**).

1. **Strategy** and **Version** — which idea, and which saved copy of it.
2. **Run name** — any name you will recognise later.
3. **Period and capital** — **From** and **To** dates, **Initial capital** (pretend starting money, in ₹),
   and tick **Compare with NIFTY 50** to see how the market itself did.
4. **Symbols → Test on**:
   - **Chosen symbols**: search by name, filter by index, sector or "F&O only", tick rows or press
     *Select all shown*. The count of chosen shares shows above the list.
   - **A whole index**: e.g. all NIFTY 50 shares. You can pick any of the 19 NSE indices NOVA knows
     (NIFTY 500, NIFTY MIDCAP 100, NIFTY IT …); the number after each is how many shares it has. A big
     index needs prices downloaded for all its shares first.
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
- A note when live price recording is on but waits for today's Kite login.
- A warning if we are using more than **80%** of any Zerodha request limit.
- **Recent activity**: the latest entries from the audit log.

### Step 3 — Do the daily Kite login
Zerodha requires a fresh login every day: a login is valid until **6:00 AM the next morning** (IST).
The account's Kite app must be set up once first (Step 5, **Kite app**); until then the reminder shows
**Set up the Kite app** instead of **Log in to Kite**.
1. On **Overview** or **Broker → an account**, press **Log in to Kite**.
2. Zerodha's own login page opens. Log in there (NOVA never sees your Zerodha password).
3. You come back to the account page and a **Finish Kite login** box asks for your **passphrase**
   (the one you chose when you saved the Kite keys). Type it and press **Finish login**.
4. You see **Kite connected** ✓. If the passphrase is wrong you can try again; after 5 wrong tries, or if
   you wait more than 2 minutes, you see **Kite login failed**: press **Log in to Kite** again.
   The audit log says why a login failed (e.g. you logged in with a different Zerodha ID).

### Step 4 — Broker
Everything about Zerodha on one page, top to bottom:
- A warning if any account uses more than **80%** of a request limit. Press the account's name to see its limits.
- **Broker accounts**: name, client ID, session status and when it expires. Press a name to open the account.
- Facts about Zerodha: the API type, the daily session rule and **Useful links** to Zerodha pages.
  Each account's own Kite app (keys, plan, static IP) is on the account's page (Step 5).

To add an account, press **Add account**, fill in **Account name** (any name, e.g. *Main*) and
**Zerodha client ID** (your Zerodha user ID, e.g. *AB1234*), then press **Add account** again.
The new account starts as **Not logged in**: open it, set up its **Kite app** (Step 5), then do the daily
Kite login (Step 3).
Each client ID can be added only once. Adding an account is written in the audit log.

### Step 5 — One account
Shows **Logged in**, **Expires** and **Time left** for the Kite session, the account's **Kite app** and its
**Rate limits**.

**Kite app** (each family member has their own app in the Kite developer console):
- **API key** shows only the last 4 characters. **API secret** says **Saved, locked by your passphrase** or
  **Not saved**; NOVA never shows the secret again.
- **Set key and secret**: paste the **API key** and **API secret** from the Kite developer console, choose
  a **Passphrase** (at least 12 characters; a short sentence is easy to remember) and type it again in
  **Confirm passphrase**, then **Save keys**. The passphrase locks the secret: NOVA does not keep it, so
  **NOVA cannot recover it**. If you forget it, simply enter the key and secret again with a new one.
  Saving a *different* API key logs the account out of Kite.
- **Redirect URL**: paste this into your app in the Kite developer console.
- **Edit details**: plan, renewal date, postback URL and static IP, for your reference.
- **Test passphrase** checks your passphrase without logging in.
Zerodha only allows a certain number of requests per second, per minute and per day. For each kind of
request (quotes, historical data, orders, other) you see:
- **Broker limit** — Zerodha's maximum;
- **NOVA limit** — our own, safer maximum (by default 90% of Zerodha's);
- **Used** now, **% used**, and when the daily count **resets**;
- an **Above 80%** flag when we are close to the limit.

Press **Edit limits** to change the NOVA limit. It can never be set above Zerodha's limit. Every change is
written in the audit log. **Back to broker** returns to the list.

### Step 6 — Instruments (the stock list)
The list of stocks you can download prices for: after a sync, **every stock listed on the NSE** (about
3,900, including small SME companies and ETFs). Each row shows the symbol, name, sector, the indices it
belongs to, and **Kite**: **Synced** means Zerodha knows the stock and its prices can be downloaded.

- **Sync with Kite** (the card at the top): brings in new NSE stocks and updates which stocks belong to
  which index (NIFTY 50, NIFTY IT, NIFTY MIDCAP 100 and 16 more). The card shows the progress while it
  runs and, afterwards, **Last synced** with one line such as "3,860 stocks synced; 2 new listing(s):
  ABC, XYZ". **View job** opens it in Data jobs. Do the daily Kite login first.
- NOVA also syncs **by itself every weekday from 08:45**, as soon as the Kite login of the day is done.
- **Index**: show only the stocks of one index. The number after each index is how many stocks it has.
- **Search stocks**: find a stock by symbol, name or sector.
- **New listings** tab: stocks that appeared since the previous sync, marked **New** — for example a
  company that just had its IPO (its first day of trading). An IPO shows up on its listing day, not
  before: Zerodha only lists a stock once it trades. **Mark as seen** removes the **New** mark.
- **Sector** comes from the NSE's index lists, so only stocks in at least one of the 19 indices have one;
  the others show **Unclassified** until you **Edit** them.
- **Add stock** is rarely needed now (the sync adds NSE stocks). **Edit** changes the name, sector or
  indices. **Remove** takes a stock off the list; prices already downloaded stay (the next sync adds an
  NSE stock back).

### Step 7 — Data jobs
Background work that fills our price database: **historical downloads** (past candles from Zerodha),
**tick recording** (live prices during market hours) and **archiving** (moving old live prices to files).
Each job shows status, symbols, period, progress % and rows written. Open one for details or the error if it
failed.

**Updates appear by themselves.** In Real mode a small **Live** badge sits at the top right: job lists and job
pages change the moment the work moves on, with no reload. If it shows **Reconnecting…**, the connection
dropped for a moment; the pages then refresh every few seconds until **Live** is back.

**To download past prices:** press **New download**, choose the **Timeframe** (the size of each price bar,
from **1 minute** to **1 day**), the **From** and **To** dates and the stocks. Tick stocks one by one (use the
search box), or add a whole group with **Add index…** (for example all of NIFTY BANK) or **Add sector…**;
**Clear** empties the list. Only stocks *synced* with Kite can be picked. Then press **Check plan**.

**Check the plan before it runs.** Nothing is downloaded yet. The plan shows, for each stock, the prices
already stored and how many *steps* (one request to Zerodha each) are still needed, plus the total rows, the
size on disk, about how long it takes and when it starts (**Now**, or after the jobs ahead). With **Skip
data already there** (the default) stored prices are not fetched again; choose **Overwrite** to fetch
everything again. If all of it is stored you see **Nothing to download**. Press **Start** to begin, or
**Back** to change the stocks or dates. A plan you leave without starting shows as **Planned** in the list
and can be started from its page within 24 hours.

**To pause a download**, open it and press **Pause**: it stops after the step it is on, and every finished
step is kept. **Resume** continues from the next step, even after the computer was restarted.

**To stop a job** that is planned, waiting, running or paused, open it and press **Cancel job**, then
confirm. Prices already saved stay.

**To delete a job** you no longer want (for example a test), open it and press **Delete job**. This works
for planned, completed, failed and cancelled jobs; stop a running one first. For a download you can tick
**Also delete the candles it downloaded**: that removes every stored price of those stocks, that timeframe
and those dates, even prices another download saved there. Leave it unticked to keep the prices. The audit
log keeps a line about every delete.

**Download pace** (the card at the top): during market hours (weekdays 09:15–15:30) downloads **Slow down**
to one request a second, so live prices keep flowing. Choose **Full pace** to download at full speed all day.

**Live prices** (the card at the top): turn on **Record live prices** and NOVA records every price change
(*ticks*) of the chosen stocks every weekday from 09:15 to 15:30, by itself, until you turn it off. Past
prices can't be recorded later, so leave it on. The badge says what it is doing: **Off**, **Waiting for
market hours**, **Recording** (with a link to today's recording job) or **Log in to Kite first** (do the
daily Kite login, Step 3). **Choose stocks** picks which synced stocks to record; with none ticked it
records all of them. Cancelling a running recording job also turns the switch off.

**Archive old ticks** moves live prices older than a date (default: 30 days ago) out of the database into
files, to keep the database small. Nothing is lost. It runs as a data job.

### Step 8 — Audit log
A permanent diary of important actions: sign-ins (also failed ones), Kite logins, session expiries, broker
accounts added, Kite app keys or details changed, limit changes, stocks added or synced, recording switched on or off, strategies created or saved, backtests queued, downloads queued or cancelled. Each line shows time, who, what, on what, and a
summary. Use **Show** to filter by kind of activity and **Load older entries** to go back in time.

---

## 6. What is NOT there yet (not bugs)

- **No real buying or selling.** Placing orders is a later phase (NOVA Launch).
- Broker accounts cannot be renamed, disabled or removed from the screen yet.
- Strategies cannot be deleted (old test results depend on them); set them to *Archived* instead.
- Backtests are for **shares only** (delivery and intraday); futures and options come later.
- The market-data chart shows the last year of daily candles (or the last 5 days of intraday) by default.
- Only one person (the super-admin) can sign in for now; family roles come later.

---

## 7. Quick "what do I do if…"

| Problem | What to do |
|---|---|
| Yellow bar at the top | You are in demo mode: nothing you do is saved. |
| Backtest says *Log in to Kite in Relay first* or data is missing | Do the daily Kite login in Relay (Step 3), then queue a download in **Data jobs** (Step 7). |
| A download *Failed* with *Not synced with Kite* | The stock is not synced with Kite yet. Press **Sync with Kite** on the Instruments page, then queue it again. |
| A download *Failed* with *Kite is not logged in today* | Do the daily Kite login on the **Broker** page, then queue the download again. |
| A download *Failed* with *The broker service did not answer* | NOVA's broker part is not running. Start the whole NOVA stack again, then queue the download again. |
| A download *Failed* with *Kite refused the request* | Zerodha said no (the reason follows). Often it is busy: wait a minute and queue it again. |
| A download *Failed* with *Unexpected error* | Something broke inside NOVA. Queue it again once; if it fails the same way, send the message to the Owner. |
| A job page shows an old status | With **Live** at the top right it updates at once. With **Reconnecting…** (or in Demo) it refreshes every few seconds while a job is **Queued** or **Running**. If **Reconnecting…** stays for minutes, check that NOVA is running, then reload the page. |
| A download shows **Paused** | It was paused and keeps its finished steps. Open it and press **Resume**. |
| A download is **Planned** but never ran | A plan waits for **Start**. Open it and press **Start** (plans older than 24 hours are cancelled; check the plan again). |
| A stock stays **Not synced** after a sync | Zerodha does not know that symbol on NSE. Check the spelling (Edit is not possible for the symbol: remove it and add it again). |
| Backtest *Failed* | Open it: the red box explains why (e.g. a Python error or missing data). |
| Backtest fails with *Unknown setting … save it again* | The strategy was saved before indicators got their own settings. Open it, press **Edit**, then **Save draft**. |
| Signed out suddenly | Your session expired. Sign in again. |
| Rate-limit warning above 80% | Press the account's name in the warning to see which limit. Wait for the reset time shown, or lower how much you download at once. |
| Forgot the Kite passphrase | Open the account, press **Set key and secret** and enter the API key and secret again (from the Kite developer console) with a new passphrase. |
| **Kite login failed** after entering the passphrase | Too many wrong tries or more than 2 minutes passed. Press **Log in to Kite** again. |
| **Live prices** says **Log in to Kite first** | Recording is on but today's Kite login is missing. Do the daily login (Step 3); recording starts within a minute. |
