# NOVA — Strategy library (D62)

> The 60 strategies shipped with NOVA (NOVA-121) and added from Orbit's **Library** page (NOVA-122).
> Written by Claude; the implementer copies them into data exactly. Settings are textbook values, **not tuned on NSE data**.
> Goal behind them: ₹10 L → at least ₹2.5 L a year after tax, NIFTY 100 (D62). Backtests are evidence, not promises.

## 1. Notation
- Prices: `close`, `open`, `high`, `low`, `volume`. `[n]` = n bars ago (`offset`). `1.5 × x` = operand `multiplier` 1.5.
- Indicators take their catalog settings in catalog order; every setting is written in the data, even defaults:
  `sma(p)` `ema(p)` `roc(p)` `rsi(p)` `atr(p)` `adx(p)` `plus_di(p)` `minus_di(p)` `cci(p)` `mfi(p)` `williams_r(p)`
  `macd(fast,slow)` `macd_signal(fast,slow,signal)` `macd_hist(fast,slow,signal)` `supertrend(period,multiplier)` `psar(step,max)`
  `stoch_k(period,smooth)` `stoch_d(period,smooth,signal)` `stoch_rsi(rsi_period,period)` `bb_upper|bb_middle|bb_lower(period,stddev)`
  `keltner_upper|keltner_lower(period,multiplier,atr_period)` `donchian_upper|donchian_lower(p)` `volume_sma(p)` `vwap()`
  `prev_day_high|prev_day_low|prev_day_close|pivot|pivot_r1|pivot_s1()`; new in NOVA-116: `volatility(p)` `risk_adj_return(p)`
  `pct_of_high(p)` `or_high(minutes)` `or_low(minutes)`.
- Operators: `>` gt, `>=` gte, `<` lt, `<=` lte, `x>` crosses_above, `x<` crosses_below. **ALL** / **ANY** = combinator.
- Risk: `SL` stopLossPercent, `TP` targetPercent, `TRAIL` trailingStopPercent, `ATR(p,m)` atrStop, `HOLD n` maxHoldBars. Not listed = null/absent.

## 2. Defaults per family
| Family (`family` id) | Mode, segment, timeframe | Sizing | Portfolio | Market filter (`regime`) |
|---|---|---|---|---|
| A Momentum rotation (`momentum_rotation`) | rotation, equity_delivery, 1d | equity ÷ hold | — | NIFTY 50: `close > sma(200)`, **exit_all** |
| B Trend and breakout (`trend`) | visual, equity_delivery, 1d | percent_equity 10 | max 10, rank `roc(126)` desc | NIFTY 50: `close > sma(200)`, no_new_entries |
| C Pullback in an uptrend (`pullback`) | visual, equity_delivery, 1d | percent_equity 10 | max 10, rank as listed | same as B |
| D Price patterns (`pattern`) | python, equity_delivery, 1d | percent_equity 10 | max 10, rank `roc(126)` desc | same as B |
| E Low turnover (`low_turnover`) | visual, equity_delivery, 1d | percent_equity 10 | max 10, rank `roc(252)` desc | same as B |
| F Baselines (`baseline`) | visual, equity_delivery, 1d | as listed | as listed | none |
| G Intraday 15m (`intraday`) | visual, equity_intraday, 15m | percent_equity 20 | max 5, rank `roc(4)` desc | none |

Exchange is always `NSE`. Rotation defaults: `rebalance` monthly, `hold` 10, `keepWithin` 20, no filter.
**Suggested backtest** (the Library's Backtest button): universe index `NIFTY 100`, capital ₹10,00,000, benchmark `NIFTY 50`;
A–F from 2021-10-01 to 2024-09-30 (v1, in-sample); G from 2023-01-02 to 2024-12-31. Name: "<strategy name> — v1 in-sample".

## 3. A — Momentum rotation
Idea: stocks that rose most over 3–12 months tend to keep outperforming for months. Watch: sharp momentum crashes (Oct 2024–Mar 2025).
| ID | Name | Score (weight) | Changes to the defaults |
|---|---|---|---|
| A01 | 12-1 momentum | `roc(231)[21]` ×1 | — |
| A02 | 6-month momentum | `roc(126)` ×1 | — |
| A03 | Blended momentum | `roc(63)` ×1, `roc(126)` ×1, `roc(252)` ×1 | — |
| A04 | Risk-adjusted momentum | `risk_adj_return(126)` ×1, `risk_adj_return(252)` ×1 | — |
| A05 | Concentrated risk-adjusted | as A04 | hold 5, keepWithin 10, SL 20 |
| A06 | Diversified blend | as A03 | hold 20, keepWithin 30 |
| A07 | Trend-qualified momentum | `roc(126)` ×1 | filter ALL: `close > sma(50)`, `sma(50) > sma(200)` |
| A08 | 52-week-high leaders | `pct_of_high(252)` ×1, `roc(126)` ×0.1 | — |
| A09 | Fast weekly momentum | `roc(63)` ×1 | rebalance weekly, SL 10 |
| A10 | Low-volatility momentum | `roc(126)` ×1 | filter ALL: `volatility(252) < 30` |
| A11 | Momentum, not overheated | `roc(126)` ×1 | filter ALL: `rsi(14) < 75` (an overheated holding is sold at the rebalance) |
| A12 | Quarterly momentum | `roc(231)[21]` ×1 | rebalance quarterly, hold 15, keepWithin 25 |

## 4. B — Trend and breakout
Idea: ride strong trends, cut losers early; few big winners pay for many small losses. Watch: choppy years, low win rate.
| ID | Name | Entry | Exit | Risk |
|---|---|---|---|---|
| B01 | Turtle 55/20 | ALL `close > donchian_upper(55)[1]` | ANY `close < donchian_lower(20)[1]` | SL 10 |
| B02 | 52-week breakout on volume | ALL `close > donchian_upper(252)[1]`, `volume > 1.5 × volume_sma(50)` | ANY `close < ema(100)` | ATR(14,3) |
| B03 | Trend template breakout | ALL `close > sma(50)`, `sma(50) > sma(150)`, `sma(150) > sma(200)`, `sma(200) > sma(200)[21]`, `close >= 1.3 × donchian_lower(252)`, `close >= 0.75 × donchian_upper(252)`, `close > donchian_upper(20)[1]`, `volume > 1.4 × volume_sma(50)` | ANY `close < sma(50)` | SL 8 |
| B04 | SuperTrend + EMA 200 | ALL `close x> supertrend(10,3)`, `close > ema(200)` | ANY `close < supertrend(10,3)` | — |
| B05 | EMA 20/50 cross | ALL `ema(20) x> ema(50)`, `close > sma(200)` | ANY `ema(20) < ema(50)` | — |
| B06 | MACD with trend | ALL `macd(12,26) x> macd_signal(12,26,9)`, `macd(12,26) > 0`, `close > ema(200)` | ANY `macd_hist(12,26,9) < 0` | — |
| B07 | DMI/ADX trend | ALL `plus_di(14) x> minus_di(14)`, `adx(14) > 25`, `close > ema(100)` | ANY `minus_di(14) > plus_di(14)` | — |
| B08 | Squeeze breakout | ALL `bb_upper(20,2)[1] < keltner_upper(20,1.5,10)[1]`, `close > bb_upper(20,2)`, `close > sma(200)` | ANY `close < ema(20)` | — |
| B09 | Keltner breakout | ALL `close x> keltner_upper(20,2,10)`, `adx(14) > 20` | ANY `close < ema(20)` | — |
| B10 | Darvas box | ALL `close > donchian_upper(20)[1]`, `roc(126) > 20`, `close > sma(50)` | ANY `close < sma(100)` | TRAIL 10 |
| B11 | Golden-cross trend | ALL `sma(50) > sma(200)`, `close > sma(50)` | ANY `sma(50) < sma(200)` | — |
| B12 | Parabolic SAR trend | ALL `close x> psar(0.02,0.2)`, `close > ema(200)`, `adx(14) > 20` | ANY `close < psar(0.02,0.2)` | — |
| B13 | Chandelier trend | ALL `ema(50) > ema(200)`, `roc(63) > 10`, `close > donchian_upper(50)[1]` | ANY `close < ema(200)` | ATR(22,3) |
| B14 | 6-month breakout, time-boxed | ALL `close > donchian_upper(126)[1]` | ANY `close < sma(200)` | TRAIL 15, HOLD 60 |

## 5. C — Pullback in an uptrend
Idea: in a rising stock, short dips tend to recover within days. Watch: a dip that turns into a crash; many trades, so charges matter.
| ID | Name | Entry | Exit | Risk | Rank |
|---|---|---|---|---|---|
| C01 | RSI(2) classic | ALL `rsi(2) < 10`, `close > sma(200)` | ANY `close > sma(5)` | HOLD 10 | `rsi(2)` asc |
| C02 | RSI(2) two-day | ALL `rsi(2) < 15`, `rsi(2)[1] < 15`, `close > sma(200)` | ANY `rsi(2) > 70` | HOLD 10 | `rsi(2)` asc |
| C03 | Bollinger bounce | ALL `close < bb_lower(20,2)`, `close > sma(200)` | ANY `close > bb_middle(20,2)` | SL 8 | `rsi(14)` asc |
| C04 | Three down days | ALL `close < close[1]`, `close[1] < close[2]`, `close[2] < close[3]`, `close > sma(200)` | ANY `close > sma(5)` | HOLD 10 | `rsi(2)` asc |
| C05 | EMA-20 pullback | ALL `ema(20) > ema(50)`, `ema(50) > ema(200)`, `low <= ema(20)`, `close > ema(20)` | ANY `close < ema(50)` | SL 5, TP 8 | `roc(126)` desc |
| C06 | Stochastic turn | ALL `stoch_k(14,3) x> stoch_d(14,3,3)`, `stoch_k(14,3) < 25`, `close > sma(200)` | ANY `stoch_k(14,3) > 80` | SL 8 | `stoch_k(14,3)` asc |
| C07 | Williams %R | ALL `williams_r(10) < -90`, `close > sma(200)` | ANY `williams_r(10) > -30` | HOLD 15 | `williams_r(10)` asc |
| C08 | CCI dip | ALL `cci(20) < -100`, `adx(14) > 20`, `close > sma(200)` | ANY `cci(20) > 100` | SL 8, HOLD 20 | `cci(20)` asc |
| C09 | MFI dip | ALL `mfi(14) < 25`, `close > sma(200)` | ANY `mfi(14) > 60` | SL 8 | `mfi(14)` asc |
| C10 | Stoch-RSI dip | ALL `stoch_rsi(14,14) < 10`, `close > ema(100)` | ANY `stoch_rsi(14,14) > 80` | SL 8 | `stoch_rsi(14,14)` asc |
| C11 | Dip + cost averaging | ALL `rsi(14) < 35`, `close > sma(200)` | ANY `rsi(14) > 70` | SL 15, TP 10; averaging drop 4, max adds 2; sizing 5 | `rsi(14)` asc |
| C12 | Reversal day | ALL `open < prev_day_low()`, `close > open`, `close > sma(200)` | ANY `close > prev_day_high()` | SL 6, HOLD 5 | `rsi(2)` asc |
| C13 | Leaders on sale | ALL `roc(126) > 25`, `close <= 0.9 × donchian_upper(20)`, `rsi(14) < 45` | ANY `close > donchian_upper(20)[1]` | SL 8, TP 12 | `roc(126)` desc |
| C14 | Keltner snap-back | ALL `close < keltner_lower(20,2,10)`, `close > sma(200)` | ANY `close > ema(20)` | SL 8 | `rsi(14)` asc |

## 6. D — Price patterns (Python)
Idea: classic chart setups the visual rules cannot express. Watch: the code assumes its own signal was filled; if no slot was free,
it may wait for its own exit before signalling again. Code is copied exactly (D47 rules: no imports, no `_` names).

**D01 NR7 inside-bar breakout** · SL 6, HOLD 8
```python
class Strategy:
    def __init__(self):
        self.highs = []
        self.lows = []

    def on_bar(self, ctx):
        self.highs.append(ctx.high)
        self.lows.append(ctx.low)
        highs, lows = self.highs, self.lows
        fast = ctx.sma(10)
        trend = ctx.sma(200)
        if fast is None or trend is None or len(highs) < 9:
            return None
        if ctx.close < fast:
            return "exit"
        ranges = [highs[i] - lows[i] for i in range(-8, -1)]
        inside = highs[-2] < highs[-3] and lows[-2] > lows[-3]
        if inside and ranges[-1] <= min(ranges) and ctx.close > highs[-2] and ctx.close > trend:
            return "enter"
        return None
```
**D02 IBS reversion** · SL 8, HOLD 10
```python
class Strategy:
    def on_bar(self, ctx):
        trend = ctx.sma(200)
        if trend is None:
            return None
        spread = ctx.high - ctx.low
        ibs = (ctx.close - ctx.low) / spread if spread > 0 else 0.5
        if ibs > 0.8:
            return "exit"
        if ibs < 0.15 and ctx.close > trend:
            return "enter"
        return None
```
**D03 VCP-lite** · TRAIL 12
```python
class Strategy:
    def __init__(self):
        self.highs = []
        self.lows = []
        self.volumes = []

    def on_bar(self, ctx):
        self.highs.append(ctx.high)
        self.lows.append(ctx.low)
        self.volumes.append(ctx.volume)
        mid = ctx.sma(50)
        if mid is None or len(self.highs) < 51:
            return None
        if ctx.close < mid:
            return "exit"
        highs, lows, vols = self.highs, self.lows, self.volumes
        r20 = max(highs[-21:-1]) - min(lows[-21:-1])
        r10 = max(highs[-11:-1]) - min(lows[-11:-1])
        r5 = max(highs[-6:-1]) - min(lows[-6:-1])
        tight = r20 > r10 > r5 and r5 < 0.06 * ctx.close
        quiet = sum(vols[-6:-1]) / 5 < 0.7 * sum(vols[-51:-1]) / 50
        if tight and quiet and ctx.close > max(highs[-21:-1]):
            return "enter"
        return None
```
**D04 Pocket pivot** · SL 8
```python
class Strategy:
    def __init__(self):
        self.closes = []
        self.volumes = []

    def on_bar(self, ctx):
        self.closes.append(ctx.close)
        self.volumes.append(ctx.volume)
        trend = ctx.sma(50)
        near = ctx.sma(10)
        closes, vols = self.closes, self.volumes
        if trend is None or near is None or len(closes) < 12:
            return None
        if ctx.close < trend:
            return "exit"
        down = [vols[i] for i in range(-11, -1) if closes[i] < closes[i - 1]]
        biggest = max(down) if down else 0
        if closes[-1] > closes[-2] and ctx.volume > biggest and abs(ctx.close / near - 1) < 0.03:
            return "enter"
        return None
```
**D05 Weekly trend on daily bars** (decides on the first bar of each week from last week's close) · SL 12
```python
class Strategy:
    def __init__(self):
        self.last_day = None
        self.prev_close = None
        self.week_closes = []

    def day_number(self, text):
        y, m, d = int(text[0:4]), int(text[5:7]), int(text[8:10])
        y -= m <= 2
        era = (y if y >= 0 else y - 399) // 400
        yoe = y - era * 400
        doy = (153 * (m + (-3 if m > 2 else 9)) + 2) // 5 + d - 1
        doe = yoe * 365 + yoe // 4 - yoe // 100 + doy
        return era * 146097 + doe - 719468 + (1 if int(text[11:13]) >= 18 else 0)

    def on_bar(self, ctx):
        day = self.day_number(ctx.time)
        signal = None
        if self.last_day is not None and (
            (day + 3) % 7 < (self.last_day + 3) % 7 or day - self.last_day >= 7
        ):
            self.week_closes.append(self.prev_close)
            weeks = self.week_closes
            if len(weeks) >= 11:
                if weeks[-1] < sum(weeks[-10:]) / 10:
                    signal = "exit"
                elif weeks[-1] / weeks[-5] - 1 > 0.05:
                    signal = "enter"
        self.last_day = day
        self.prev_close = ctx.close
        return signal
```
**D06 Volatility expansion** · SL 8
```python
class Strategy:
    def __init__(self):
        self.widths = []
        self.armed = 0

    def on_bar(self, ctx):
        upper = ctx.bb_upper(20, 2)
        lower = ctx.bb_lower(20, 2)
        middle = ctx.bb_middle(20, 2)
        trend = ctx.sma(200)
        exit_line = ctx.ema(20)
        if None in (upper, lower, middle, trend, exit_line) or middle <= 0:
            return None
        width = (upper - lower) / middle
        history = self.widths[-126:]
        self.widths.append(width)
        if len(history) == 126 and width <= min(history):
            self.armed = 10
        elif self.armed > 0:
            self.armed -= 1
        if ctx.close < exit_line:
            return "exit"
        if self.armed > 0 and ctx.close > upper and ctx.close > trend:
            return "enter"
        return None
```

## 7. E — Low turnover, F — Baselines
E idea: hold strong stocks for months; fewer trades, more long-term (12.5%) tax. F: the bar every strategy must beat.
| ID | Name | Entry | Exit | Risk / other |
|---|---|---|---|---|
| E01 | Trend-filtered hold | ALL `close > sma(200)`, `sma(50) > sma(200)` | ANY `close < 0.9 × sma(200)` | — |
| E02 | Compounders | ALL `sma(100) > sma(100)[63]`, `close > sma(100)`, `roc(252) > 15` | ANY `close < sma(200)` | — |
| F01 | Equal-weight buy and hold | ALL `close > 0` | ANY `close < 0` | sizing 1, no portfolio, no filter |
| F02 | Above the 200-day | ALL `close x> sma(200)` | ANY `close x< sma(200)` | sizing 5, max 20 rank `roc(126)` desc, no filter |

## 8. G — Intraday, 15-minute (MIS, testing)
Idea: same-day moves after the open, squared off from 15:20 (D46). Watch: charges and slippage eat small edges; intraday profit is
business income (no tax estimate). Needs 1m candles for the period (15m is built from them, D58).
| ID | Name | Entry | Exit | Risk |
|---|---|---|---|---|
| G01 | Opening range breakout 15 | ALL `close x> or_high(15)`, `close > vwap()`, `volume > 1.5 × volume_sma(20)` | ANY `close < vwap()` | SL 1, TP 2 |
| G02 | Opening range breakout 30 | ALL `close x> or_high(30)`, `close > vwap()` | ANY `close < vwap()` | SL 1.2, TP 2.5 |
| G03 | VWAP pullback in trend | ALL `ema(20) > ema(50)`, `low < vwap()`, `close > vwap()`, `close > prev_day_close()` | ANY `close < ema(20)` | SL 0.8, TP 1.6 |
| G04 | VWAP reclaim | ALL `close x> vwap()`, `rsi(14) > 50`, `adx(14) > 20` | ANY `close x< vwap()` | SL 1, TP 2 |
| G05 | Previous-day high break | ALL `close x> prev_day_high()`, `volume > 1.5 × volume_sma(20)` | ANY `close < vwap()` | SL 1, TP 2 |
| G06 | Pivot S1 bounce | ALL `low <= pivot_s1()`, `close > pivot_s1()`, `close > ema(200)` | ANY `close > pivot()` | SL 0.8, TP 1.5 |
| G07 | Pivot R1 breakout | ALL `close x> pivot_r1()`, `close > vwap()`, `volume > 1.5 × volume_sma(20)` | ANY `close < pivot()`, `close > pivot_r2()` | SL 1, TP 2 |
| G08 | SuperTrend 15m | ALL `close x> supertrend(10,3)`, `close > ema(200)`, `adx(14) > 20` | ANY `close < supertrend(10,3)` | SL 1.5 |
| G09 | RSI dip in trend | ALL `rsi(14) < 35`, `ema(50) > ema(200)`, `close > prev_day_low()` | ANY `rsi(14) > 60` | SL 1, TP 1.5 |
| G10 | Squeeze breakout 15m | ALL `bb_upper(20,2)[1] < keltner_upper(20,1.5,10)[1]`, `close > bb_upper(20,2)`, `close > vwap()` | ANY `close < ema(20)` | SL 1, TP 2 |

## 9. How results are judged (D62 (8))
v1 in-sample → v2 out-of-sample (2024-10-01 → 2026-09-25) → v3 full 5 years, as versions of one backtest (**Edit**).
Pass: after-tax CAGR ≥ 25%, max drawdown ≤ 25%, no year below −5%, ≥ 40 trades, top 3 stocks < 50% of profit,
v2 CAGR ≥ 60% of v1. F01/F02 and the benchmark show what "doing nothing clever" earned. The final pick is 2–3 passing
strategies from different families; paper trading (Phase 2) comes before real money.
