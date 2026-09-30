# NOVA — User guide (what works today)

> Written for anyone in the family, no technical knowledge needed.
> State as of **30 Sep 2026** (Stage B, tasks up to NOVA-148). NOVA **never places real orders**: it only
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
- Tables with page controls show **Showing … of … entries** and **Page … of …** for all matching server rows.
  Use **First page**, **Previous page**, **Next page** or **Last page**, or type in **Jump to page** and press Enter.
  **Rows per page** changes how many rows you see and returns to page 1.
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
- test results so far: number of runs, **Best CAGR** and **Worst CAGR**, win rate, worst drop, and best net profit
  (click it to open that test). **CAGR** means average growth per year, so short and long tests compare fairly.
  With just one completed test, the card shows one **Return** and one **CAGR**, even while another test runs.

Use **Status** to show only drafts/active/archived, and **Sort by** to order by *Recently updated*,
**Best CAGR** or *Most runs*.

### Step 3 — Open one strategy
Click a card. You see:
- the **rules written in plain words** (e.g. "Enter when Close crosses above SMA(20)");
- a **Backtests** tab: every test run of this strategy;
- a **Versions** tab: every saved copy with its date, note and its **Backtests** record (how many finished
  test runs used that version and its best return, which opens that run).

Buttons: **Edit**, **Run backtest** and **Delete strategy**.

**Delete a strategy.** **Delete strategy** asks first, then removes the strategy, every saved version and every
backtest of it (their trades and results too). This cannot be undone. You go back to the strategy list.

**Look at an older version.** On the **Versions** tab, press a version number (e.g. **v1**): you see that
version's full rules, its note and date, and its backtest record. **Run backtest** there tests that exact version.

**Compare two versions.** Tick two versions and press **Compare versions**. The two versions stand side by
side, older on the left, one line per setting or rule. Lines that differ are highlighted and marked
**Changed**, **Added** or **Removed**; **Show changes only** hides the lines that are the same. The top of
the page shows each version's backtest record, so you can see which change made the strategy better.

### Step 4 — Create or edit a strategy (visual rules — no coding)
Go to **Strategies → New strategy** (or **Edit** on an existing one).

1. **Basics** — give it a **Name** and **Description**, choose **Segment** (delivery or intraday),
   **Exchange** (NSE) and **Timeframe** (candle size, e.g. 1 day or 5 minutes).
2. **Entry rules** — *when to buy*. Each rule is: **Left** thing · comparison · **Right** thing.
   - A "thing" can be a **Price** (Open, High, Low, Close, Volume), an **Indicator**, or a plain **Number**.
   - An *indicator* is a number calculated from past prices. The **Indicator** list has 43, in groups.
     Choosing one shows its own settings (for example MACD: **Fast**, **Slow**, **Signal**), already filled
     with the usual values. You can change them.
     - **Trend**: moving averages (SMA, EMA, WMA), MACD; **SuperTrend** (a line under the price in an
       up-trend, above it in a down-trend); **ADX** (how strong a trend is, whatever its direction) with
       **+DI / −DI** (buying vs selling pressure); **Parabolic SAR** (a trailing stop that follows the trend).
     - **Momentum**: RSI; **Stochastic** (where the close sits in the recent high–low range); **CCI** (how far
       the price is from its average); **Williams %R** (like Stochastic, from 0 down to −100); rate of change %.
       - **Risk-adjusted return**: the rise over a period divided by how bumpy it was (higher = a steadier rise).
       - **% of N-bar high**: today's close as a percentage of the highest price in that period (100 = a new high).
     - **Volatility**: ATR (the average daily range), Bollinger bands; **Keltner** bands (average ± ATR);
       **Highest high / Lowest low** of the last few candles (Donchian).
       - **Volatility % (yearly)**: how much the price jumps around, as a yearly percentage.
     - **Volume**: VWAP; **OBV** (volume added on up days, taken away on down days); **MFI** (like RSI but
       weighted by volume); Volume SMA.
     - **Levels (previous day)**: yesterday's high, low and close, and the **pivot** levels traders compute
       from them (Pivot, R1/R2 above it, S1/S2 below it).
       - **Opening range high / low**: the highest and lowest price of today's first minutes after 09:15
         (15 by default). It appears once those minutes are over, and only on intraday timeframes: a
         strategy on 1-day candles cannot use it.
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
5. **Exits** (all optional; leave a box empty to not use it):
   - **Trailing stop** %: sells when the price falls that much below the highest closing price since you
     bought. It follows the price up and never moves down.
   - **ATR stop**: the same idea, but the gap is a number of ATRs (**× ATR**) instead of a percentage, so it
     is wider for jumpy stocks. **Period** is how many candles the ATR averages.
   - **Exit after N bars**: sells at the next opening price once the stock has been held that many candles.
   - If a stop-loss, trailing stop and ATR stop are all set, the highest of them counts.
6. **Portfolio**: **Max positions** is the most stocks held at the same time (empty = no limit). When more
   stocks want to be bought on the same day than there are free places, **Rank buys** picks which ones:
   *rank* means sorting them by a number you choose in **Rank buys by** (for example the 6-month rate of
   change) with **Highest first** or **Lowest first**.
7. **Market filter**: a *market filter* only lets the strategy trade while the whole market looks healthy.
   Switch on **Use a market filter**, pick an **Index** and one rule on that index's own prices (it starts
   as NIFTY 50 close above its 200-day SMA). **When the filter fails**: **No new buys** keeps what you hold
   but buys nothing new; **Sell everything** sells all holdings at the next open. The index's prices must be
   downloaded (Step 6b).
   - The **×** box next to any price or indicator multiplies it, e.g. *Volume > 1.5 × Volume SMA(50)*.
     Empty means × 1.
8. The **Spec preview (JSON)** box shows the same rules in computer form. You can ignore it.
9. Press **Save draft**. It stays greyed out after a try while a box shows an error: fix the boxes in red.
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

### Step 4c — Or a rotation strategy (hold the strongest stocks)
Switch **Authoring mode** to **Rotation**. Instead of buy and sell rules, you give every stock a
**score**, and NOVA keeps the stocks with the highest scores. It always uses daily prices and delivery
(the **Segment** and **Timeframe** boxes are greyed out), and each stock bought gets an equal share of
your money.

- **Rebalance**: how often the list is checked and changed: **Every week**, **Every month** or **Every
  quarter**. Buying and selling happens only then (and after a stop).
- **Hold**: how many stocks to own, e.g. 10.
- **Keep while in top**: a stock you own is sold only when it drops below this place in the ranking, e.g.
  20. This stops NOVA from selling a stock that slips from 9th to 11th place.
- **Score**: one to three terms added together, each a price or indicator times a **Weight** (**Add term**
  adds one). Stocks with the highest score are held.
- **Only stocks where…** (optional): rules a stock must pass to be ranked at all. A stock you hold that
  fails them is sold at the next rebalance.
- **Risk**, **Exits** and **Market filter** work as in Step 4; here the market filter starts as **Sell
  everything**.

Example — *12-1 momentum*: score = **Rate of change %(231)**, **Bars ago** 21, weight 1 (the rise over the last
year, leaving out the last month); **Every month**, **Hold** 10, **Keep while in top** 20; market filter NIFTY 50
close above SMA(200), **Sell everything**.

Changing the mode starts the settings of the new mode from scratch (name and description stay). If that
would throw away settings you entered, NOVA asks first: **Switch** or **Keep editing**.

### Step 4d — Or start from the Library (100 ready-made strategies)
**Library** in the menu lists 100 strategies NOVA ships with, grouped into seven families. Each family card says
its **Idea** and what to **Watch out** for:
- **A Momentum rotation** — hold the stocks that rose most in recent months (rotation strategies, Step 4c).
- **B Trend and breakout** — buy strong breakouts, sell when the trend breaks.
- **C Pullback in an uptrend** — buy short dips in rising stocks.
- **D Price patterns** — chart patterns written in Python.
- **E Low turnover** — hold strong stocks for months.
- **F Baselines** — simple "do nothing clever" strategies every other one must beat.
- **G Intraday, 1-minute to 1-hour** — same-day trades, for testing only.

Use the family buttons or **Search** to narrow the list. **Add** copies a strategy into your **Strategies** as a
draft (then it shows **Added**); **Add all** adds every one you do not have yet, after you confirm. **Backtest**
adds it if needed and opens **Run backtest** already filled in. The original 60 use NIFTY 100 stocks, NIFTY 50 as
the benchmark, ₹10,00,000 and the test period below. The 40 new ideas use NIFTY 50 stocks and the NIFTY 50
benchmark, ₹10,00,000, 2 Jan 2023 – 31 Dec 2024. Library strategies are textbook ideas, not tuned for you:
backtests are evidence, not promises.

**How to test a Library strategy fairly (three versions of one backtest):**
1. **v1 in-sample** — the period the Backtest button fills in (1 Oct 2021 – 30 Sep 2024; intraday 2 Jan 2023 –
   31 Dec 2024).
2. **v2 out-of-sample** — press **Edit** on the finished run and change the dates to 1 Oct 2024 – 25 Sep 2026:
   call this unseen only if you never used these prices to choose or change the idea.
3. **v3 full** — **Edit** again for the whole 5 years.

A strategy passes when, in the results (Step 6): **After-tax CAGR** is 25% or more, **Max drawdown** is no worse
than −25%, no row in **Year by year** is **Below −5%**, there are at least 40 trades, the best 3 stocks bring less
than half of the profit, and v2's CAGR is at least 60% of v1's. Compare with the F baselines and the benchmark. The
aim is 2–3 passing strategies from different families; paper trading comes before real money.

The 40 new ideas include 20 same-day strategies, 12 **delivery** strategies that hold overnight,
and 8 daily position or rotation strategies. A 15-minute delivery strategy can hold for several days.
Download **1 minute** for the intraday and overnight swing ideas; other intraday candle sizes are made
from it. Daily ideas need **1 day**, including NIFTY 50 for their market filter.

For the new ideas, first test 2 Jan 2023 – 31 Dec 2024. Freeze the rules, then test 1 Jan 2025 –
25 Sep 2026. If you already used those dates to choose an idea, this checks history again; it is not
an unseen test. Compare the same dates, stock list and capital. Review **CAGR**, **Max drawdown**,
**Profit factor**, **Trades** and **Year by year**, as well as **Win rate**. Winning often can still lose
money when a few losses are large. No idea passing your requirements is a useful result too.

Charges are included. Slippage (a worse price when buying or selling), the gap between buying and
selling prices, and your trade moving the market are not simulated. Intraday tax is not estimated.
Larger intraday candles cannot recreate the exact same-day exit price at 15:20. The stock lists use
today's index members, so historical results can miss stocks later removed. None of the new entries
is a proven winner. Futures, options and short selling are not supported by this backtest engine.

### Step 5 — Run a backtest
Press **Run backtest** (on a strategy, or **Backtests → Run backtest**).

1. **Strategy** and **Version** — which idea, and which saved copy of it.
2. **Run name** — any name you will recognise later.
3. **Period and capital** — **From** and **To** dates, **Initial capital** (pretend starting money, in ₹),
   and **Benchmark** — the index to compare your result with, or **None** for no comparison. It starts
   at **NIFTY 50**. Choosing **A whole index** makes it follow that index until you change **Benchmark**
   yourself. Editing a run keeps its saved benchmark. Download the chosen index's daily prices to see
   its return, line and year-by-year comparison.
4. **Symbols → Test on**:
   - **Chosen symbols**: search by name, filter by index, sector or "F&O only", tick rows or press
     *Select all shown*. The count of chosen shares shows above the list.
   - **A whole index**: e.g. all NIFTY 50 shares. You can pick any of the 19 NSE indices NOVA knows
     (NIFTY 500, NIFTY MIDCAP 100, NIFTY IT …); the number after each is how many shares it has. A big
     index needs downloaded prices. Members with no prices during your dates are skipped and named
     on the run page. A share listed during the period joins from its first day with prices; a share
     listed after the period is skipped. If no member has prices, the run fails.
5. Press **Queue backtest**. For **Chosen symbols**, if some shares have no price data for your dates, NOVA marks them
   *Partial data* and asks whether to **Drop and queue** without them.
   A daily strategy needs daily prices. Every other candle size (3, 5, 15, 30 minutes, 1 hour) is built
   from 1-minute prices, so a 5-minute strategy needs 1-minute prices; a share with daily prices only
   shows **No 5m data** and is dropped the same way.
6. The run goes into a waiting line: status *Queued* → *Running* → *Completed* (or *Failed* with the reason).
   Open it to watch it: a waiting run says **Waiting to start**; a running one shows a **Progress** bar and
   what it is doing in plain words (*Loading prices — 12 of 50 stocks*, *Running your Python code*,
   *Simulating — reached 14 Mar 2025 · 37 trades so far*, *Saving 412 trades*), how long it has been
   running and, after a little while, about how long is left. The page updates by itself and shows the
   results as soon as the run completes. In the **Backtests** list a running run reads **Running · 42%**.

### Step 6 — Read the results
Open a run from **Backtests**. You see:
- If any index members were left out, a note below the run details says **Skipped 2 stocks with no prices
  in this period: HYUNDAI, TATACAP**, for example. It lists up to 10 names, then says how many more.
  The note also stays on an older version with only its summary, and appears on a running run when
  the skipped shares are known. There is no note when nothing was skipped.
- **Metrics**: Net P&L, Gross P&L, Charges, CAGR, Max drawdown (biggest fall from a
  high point), Sharpe (profit vs. risk; higher is better), Win rate, number of Trades.
- A second row of numbers (older runs show "—" for them):
  - **After-tax CAGR**: the yearly growth after an *estimate* of income tax on share profits at today's rates
    (short-term 20%, long-term 12.5% above ₹1.25 L a year, plus 4% cess). The card also shows the estimated
    tax. Intraday runs get no estimate (that income is taxed at your slab rate).
  - **Benchmark return**: what the same money would have made just following the index you chose (e.g.
    NIFTY 50) over the same dates. The index prices must be downloaded.
  - **Time invested**: the share of days on which money was in at least one trade.
  - **Avg days held**: how long a trade lasted on average.
  - **Profit factor**: money won on winning trades divided by money lost on losing ones (above 1 = more won
    than lost).
  - **Calmar**: CAGR divided by the max drawdown; higher means more growth for each bit of pain.
- **Year by year**: the run cut into 12-month blocks from its start date (the last may be shorter). Each row
  shows that year's return, profit, worst fall and the benchmark's return. A year that lost more than 5%
  gets a red **Below −5%** badge. The profits of all rows add up to the Net P&L.
- **Equity curve**: a line of your pretend money over time, next to a dashed line for the **Benchmark** index
  you chose (named after it), if you chose one and its daily prices are downloaded.
- **Results by symbol**: which shares made or lost money. **Show trades** filters the trade list to that share.
- **Trades**: every pretend buy and sell, with price, quantity, profit and a **charges breakdown**
  (brokerage, STT, exchange fee, SEBI fee, stamp duty, GST, DP charge) — calculated with Zerodha's real rates.

How the pretend trading works (so results are fair): a rule is checked when a candle closes and the trade
happens at the next candle's opening price, so NOVA never "peeks into the future". Intraday trades are
closed at 15:20 like Zerodha MIS.

**Change a backtest and run it again (versions).** Press **Edit** on a finished run: the form opens with its
settings (the strategy stays the same; you can pick another strategy version, other stocks, dates, capital or
name). **Queue new version** runs it as the next *version* of the same backtest (v2, v3…). The **Backtests**
list shows only the newest version, with "· v3" after its name. On the run page, the **Versions** table lists
every version with its settings and key numbers (Net P&L, Return, Win rate, Max drawdown, After-tax CAGR,
Trades), so you
can see which change helped. To save space, only the newest finished version keeps its full report; an
older version keeps just its numbers and its **Year by year** table ("Older version: only the summary is
kept").

**Delete backtests you don't want.** On a run's page press **Delete** (you are asked first): the backtest
and all its versions, trades and results are gone for good. In the **Versions** table the bin button deletes
just that one older version. In the **Backtests** list, tick several runs and press **Delete selected**.
A run that is still **Running** cannot be deleted or edited; wait for it to finish.

### Step 7 — Compare runs
Go to **Compare**, tick two or more runs. NOVA shows their metrics side by side, including after-tax CAGR,
benchmark return, profit factor and Calmar (the best value in each row is marked **Best**; a row where a run
shows "—" is not marked) and their equity curves together.

### Step 8 — Look at market data
Go to **Market data**. A table lists every share we have prices for, in any candle size (also shares with
only 1-minute prices): sector, index, last close, day change,
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

### Step 6b — Stored data (which prices are saved)
**Stored data** in the menu shows, for every stock and every index, which prices NOVA already has.
Choose the **Timeframe** (**Daily (1d)** or **1 minute (1m)**; 3-minute to 1-hour prices are built from 1-minute ones)
and the period with **From** and **To** (1 Jan 2020 to today at first). Each row shows the **First day** and **Last day** saved,
how many trading **Days** are saved in the period, how many trading days are **Missing**, and a **Status**:
- **Complete**: every trading day of the period is there. A stock listed during the period is complete from its
  listing day once a download has asked Kite for the days before it (Kite has nothing earlier).
- **Gaps**: some days in the middle are missing. A download may have stopped, or Kite may have no
  historical prices for those dates. Repeating a download cannot fill prices Kite does not return.
- **Partial**: the prices start after the period starts or end before it ends (not downloaded yet).
- **No data**: nothing is saved for this period.
- **Broker unavailable**: all missing days inside the saved history were checked successfully, but the broker returned no usable prices. The history is still incomplete. **Unavailable days** shows how many missing days have this evidence.

*Trading days* are observed sessions: daily NIFTY 50 dates combined with dates on which at least ten stocks have daily prices.
Holidays and weekends without an observed session do not count as gaps. Special sessions count even on a weekend.
A date absent from every saved instrument is unknown; this is not a verified official holiday calendar.
**Group by** puts stocks under each index they belong to (a stock in two indices shows twice) or under their sector; each
group shows how many stocks are complete, have gaps or have no data. **Only with gaps** hides complete stocks. Click a
symbol to see its missing date ranges. **Download missing** (on a group or in that window) opens **New download** with
those stocks, the timeframe and the period filled in; check the plan and press **Start** as usual.
With **Index**, **Indices** comes first and **Non-index stocks** comes last, listing stocks that belong to no index.
With **Sector**, **Unclassified** comes last, listing stocks whose sector is unknown. Both groups show stock counts
and missing days, and offer **Download missing** when prices are needed. **None** lists each stock once.
Choose the **Unavailable data** tab for exact dates, timeframe, broker response, first and last checks, number of checks and the last job.
**Availability** selects **Broker unavailable**, **Resolved** or **All history**. Use the page controls to fetch another page; search searches the visible page.
Routine downloads skip recorded unavailable dates. **Check again** opens a download plan for that exact date in overwrite mode.
When a download supplies valid prices, the record becomes **Resolved** automatically. Deleting the job preserves this history.
This records the broker response; it does not prove whether a particular absence is a broker fault. Network errors are not evidence of unavailable prices.
Example: before a 5-year backtest on NIFTY 100, choose **Daily**, group by **Index**, open **NIFTY 100** and press
**Download missing** if anything is not complete. Also check **NIFTY 50** in the **Indices** group: a strategy with a
market filter on NIFTY 50 cannot run without its daily prices, and the benchmark line needs them too.

### Step 7 — Data jobs
Background work that fills our price database: **historical downloads** (past candles from Zerodha),
**tick recording** (live prices during market hours) and **archiving** (moving old live prices to files).
Each job shows status, symbols, period, progress % and rows written. Open one for details or the error if it
failed.

After the requests finish, a download checks for missing days inside each share's stored history, within
the dates you requested. If gaps remain, it shows **Failed** with the shares and missing-day counts.
Your saved prices stay. **100%** means all requests finished; it does not override **Failed**.
Open **Stored data** and click the share to see the missing dates. The check uses the trading days known
to the platform; it cannot find a day missing from that calendar too. It does not invent daily prices
from minute prices. Successfully checked missing dates appear under **Unavailable data**, while the saved history remains incomplete.
A normal download does not fail again on dates already listed there: it shows **Completed** with a note naming the
shares and the known missing days. **Check again** still shows **Failed** if the broker still has no prices.

**Updates appear by themselves.** In Real mode a small **Live** badge sits at the top right: job lists and job
pages change the moment the work moves on, with no reload. If it shows **Reconnecting…**, the connection
dropped for a moment; the pages then refresh every few seconds until **Live** is back.

**To download past prices:** press **New download**, choose the **Timeframe** (the size of each price bar:
**1 minute** or **1 day**; 3-minute to 1-hour candles are built from 1-minute prices, so download
**1 minute** to test a 5-minute strategy), the **From** and **To** dates (1 Jan 2020 to today at first) and the stocks. Tick stocks one by one (use the
search box), or add a whole group with **Add index…** (for example all of NIFTY BANK) or **Add sector…**;
**Clear** empties the list. Only stocks *synced* with Kite can be picked. Under **Indices** you can tick index
prices too (for example **NIFTY 50**): backtests use them for the benchmark line and the market filter. Before a
5-year test, download NIFTY 50 and NIFTY 100 with **1 day** from 1 Jan 2020. Then press **Check plan**.

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

### Step 9 — Approvals and the agent account

Open **Approvals** to see changes requested by the agent account, a separate sign-in used by an AI
assistant to help check the screens. The menu shows how many requests are waiting. The page has
**Waiting**, **History** and **Agent account** tabs. **Waiting** refreshes every five seconds and shows
short rows, ten per page; phones show compact cards. **Search requests** filters the loaded requests.
Press **View details** (or the request name) to open the full request and response.

Tick the requests you want, or use **Select all shown** to select every loaded search match, including
matches on other table pages. The page controls fetch additional requests; changing page clears the selection. **Clear selection** clears your
choice. **Approve selected** or **Reject selected** opens one confirmation listing your chosen requests.
Approving runs each saved change once; rejecting runs nothing. Progress and individual problems appear
afterward. Requests arriving later are not added to your batch. Requests expire after 30 minutes and
cannot be approved after expiry. Successful decisions leave the selection; failed changes that were
already sent are not sent again. Check **History** and **View details** for their full responses.

In the **Agent account** tab, press **Create agent**, enter its name and email, and enter the same password
twice (at least 12 characters). **Set new password** replaces its password. Turn **Agent access** off
to stop sign-ins and sign out its active sessions.

The agent can read strategies, backtests, stored prices, data jobs, the audit log and approvals. It can
check a download plan without approval. Other changes show **Sent to Admin for approval** and wait for
your decision. **Back** keeps its download draft; unused drafts expire after 24 hours. The agent cannot
open **Broker**, see broker details, use broker controls, manage its account or approve requests. Its
**Approvals** page is read-only. In Real mode both apps show **Agent account: changes wait for Admin
approval**; in Demo mode the demo banner appears instead.

---

## 6. What is NOT there yet (not bugs)

- **No real buying or selling.** Placing orders is a later phase (NOVA Launch).
- Broker accounts cannot be renamed, disabled or removed from the screen yet.
- One saved version of a strategy cannot be deleted on its own: delete the whole strategy, or set it to *Archived* to hide it.
- Backtests are for **shares only** (delivery and intraday); futures and options come later.
- The market-data chart shows the last year of daily candles (or the last 5 days of intraday) by default.
- The Owner and one agent account can sign in; family roles come later.

---

## 7. Quick "what do I do if…"

| Problem | What to do |
|---|---|
| Yellow bar at the top | You are in demo mode: nothing you do is saved. |
| **Sent to Admin for approval** | The change is waiting. The Owner opens **Approvals → Waiting**, checks **View details**, selects requests and presses **Approve selected** or **Reject selected**. Check **History** for the result; if it expired, request the change again. |
| Backtest says *Log in to Kite in Relay first* or data is missing | Do the daily Kite login in Relay (Step 3), then queue a download in **Data jobs** (Step 7). |
| A backtest says prices are missing, or you are not sure what is downloaded | Open **Stored data** (Step 6b), choose the timeframe and period, group by **Index**, and press **Download missing** on the index you test. |
| A download reaches 100% but reports missing dates | Open **Stored data → Unavailable data** for the exact dates and successful broker checks. **Check again** retries an exact date; recovered prices resolve the record automatically. |
| My index run has fewer stocks than the index | Read the **Skipped** note on the run page. Those shares had no prices during your dates. A share listed later has no earlier prices to download. For other missing prices, check **Stored data** and use **Download missing**. |
| A download *Failed* with *Not synced with Kite* | The stock is not synced with Kite yet. Press **Sync with Kite** on the Instruments page, then queue it again. |
| A download *Failed* with *Kite is not logged in today* | Do the daily Kite login on the **Broker** page, then queue the download again. |
| A download *Failed* with *The broker service did not answer* | NOVA's broker part is not running. Start the whole NOVA stack again, then queue the download again. |
| A download *Failed* with *Kite refused the request* | Zerodha said no (the reason follows). Often it is busy: wait a minute and queue it again. |
| A download *Failed* with *Unexpected error* | Something broke inside NOVA. Queue it again once; if it fails the same way, send the message to the Owner. |
| A job page shows an old status | With **Live** at the top right it updates at once. With **Reconnecting…** (or in Demo) it refreshes every few seconds while a job is **Queued** or **Running**. If **Reconnecting…** stays for minutes, check that NOVA is running, then reload the page. |
| A download shows **Paused** | It was paused and keeps its finished steps. Open it and press **Resume**. |
| A download is **Planned** but never ran | A plan waits for **Start**. Open it and press **Start** (plans older than 24 hours are cancelled; check the plan again). |
| A stock stays **Not synced** after a sync | Zerodha does not know that symbol on NSE. Check the spelling (Edit is not possible for the symbol: remove it and add it again). |
| Backtest *Failed* | Open it: the red box explains why (e.g. a Python error or missing data). Under it, **Stopped while** says what the run was doing and how far it got. |
| **Edit** is missing on a backtest | It is still queued or running: edit it when it has finished. |
| An old version has no trades or chart | Only the newest finished version keeps its full report; older versions keep their numbers. Open the newest from the **Versions** table. |
| **Could not delete**: *A running backtest cannot be deleted* | Wait until it finishes (or fails), then delete it. |
| **Could not delete**: *Wait for the running backtest to finish* (deleting a strategy) | One of its backtests is running. Wait until it finishes (or fails), then delete the strategy. |
| A backtest stays **Waiting to start** | Another run is still going; runs go one at a time. If nothing is **Running** for minutes, NOVA's backtest part is not running: start the NOVA stack again. |
| Backtest *Failed* with *needs more than … price bars* | The test is too big for NOVA in one go. Pick fewer stocks or a shorter period. The most a test can use: about 100 stocks × 5 years of 1-minute prices for a rule-based strategy (it takes about 7 minutes), or about 100 stocks × 5 years of 15-minute prices for a Python strategy. One stock has about 375 one-minute bars a day. |
| Backtest *Failed* with *The backtest worker stopped during this run* | NOVA's backtest part stopped in the middle (often it ran out of memory) and has restarted. Run it again; if it stops again, pick fewer stocks or a shorter period. |
| Backtest fails with *Unknown setting … save it again* | The strategy was saved before indicators got their own settings. Open it, press **Edit**, then **Save draft**. |
| Signed out suddenly | Your session expired. Sign in again. |
| Rate-limit warning above 80% | Press the account's name in the warning to see which limit. Wait for the reset time shown, or lower how much you download at once. |
| Forgot the Kite passphrase | Open the account, press **Set key and secret** and enter the API key and secret again (from the Kite developer console) with a new passphrase. |
| **Kite login failed** after entering the passphrase | Too many wrong tries or more than 2 minutes passed. Press **Log in to Kite** again. |
| **Live prices** says **Log in to Kite first** | Recording is on but today's Kite login is missing. Do the daily login (Step 3); recording starts within a minute. |
