# Intraday safety research — frozen rules (D84)

State as of 2026-10-03 — plan only (NOVA-179–197). Source: the Owner's *Intraday Research Configuration
Strategy and Backtest Guide* (3 Oct 2026), with every open point in its chapter 23 fixed below.
The goal is **controlled losses and honest fills**, not the most profit. A day with no trade is fine.
Long only, cash equity intraday (MIS), no leverage, no orders. Changing a rule here = a new decision.

## 1. Two simulators (one backtest service)
| | Candle simulator (today) | Intraday simulator (new, `nova_backtest/intraday/`) |
|---|---|---|
| Strategies | `visual`, `python`, `rotation` | `mode: "intraday"` (setup + buying rule) |
| Data | `history` candles; D82 `recorded` runs | `recorded` ticks; `history` 1m only as **signal check** (§9) |
| Rules | D45, D46, D53, D61, D62, D82 — unchanged | this document |

Shared: indicator maths, charges (NOVA Ledger), trade saving, metrics, timeline, the runs table, screens.

## 2. Research profile (versioned settings; percent of the run's starting capital)
Saved, edited in Orbit, frozen versions never change (`hash` = SHA-256 of the canonical JSON).

| Group | Field (camelCase) | Default | Rule |
|---|---|---|---|
| Account | `initialPoolPercent` | 30 | capital currently committed by first buys |
| | `addPoolPercent` | 10 | capital currently committed by adds |
| | `reservePercent` | 60 | the three sum to ≤ 100 |
| | `stockCapPercent` / `sectorCapPercent` | 15 / 20 | committed capital, also marked value for new risk |
| | `maxPositions` | 3 | open + pending stocks |
| | `riskPerPositionPercent` | 0.10 | loss to stop incl. cost to close, whole position |
| | `openRiskPercent` | 0.20 | sum over open + pending positions |
| | `dailyLossPercent` | 0.30 | §5 shutdown |
| | `lossStreakPause` | 2 | losing positions in a row → no new positions that day |
| | `maxNewPositionsPerDay` | 5 | |
| | `cooldownMinutes` | 15 | after a stock is fully closed |
| Execution | `delayMs` / `stressDelayMs` | 250 / 1000 | decision → earliest attempt |
| | `slippageTicks` / `stressSlippageTicks` | 1 / 3 | stress ≥ base |
| | `maxQuoteAgeMs` | 1500 | by `exchange_ts` |
| | `maxSpreadBps` | 8 | (ask − bid) ÷ mid × 10,000 |
| | `maxSpreadToStopPercent` | 10 | spread ÷ (entry − stop) |
| | `maxDepthPercent` | 10 | of each depth level's quantity |
| | `minFillPercent` | 25 | supported qty below this share of the request → skip |
| Market | `marketGate` | true | |
| | `marketIndex` | NIFTY 50 | any recorded index |
| | `indexRangeMinutes` | 15 | |
| | `declineVetoPercent` | 0.3 | index fell more than this over the last 3 completed 5m bars |
| Signal | `minRelativeVolume` | 1.2 | §6 |
| | `volumeBaselineSessions` | 20 | |
| | `minStopAtr` / `maxStopAtr` | 0.5 / 2.5 | entry − stop in ATR units |
| | `atrPeriod` | 14 | Wilder, on 5m bars |
| | `contextEmaPeriod` | 20 | on 5m bars |
| | `rangeSpanAtr` | 3 | §6 range condition |
| Timing | `earliestEntry` / `lastEntry` | 09:30 / 14:30 | IST; entries and adds need attempt time < `lastEntry` |
| | `squareOff` | 15:20 | |
| | `maxHoldMinutes` | 60 | from the first fill; an add does not reset it |
| Data | `maxSessionGapSeconds` | 30 | longest recorder-wide gap in a usable session |

Fixed in v1 (shown, not editable): long only; no leverage; context 5m, confirmation 1m; charges on;
partial entries keep the filled part and cancel the rest; trailing and break-even exits off; idle cash 0 %.

## 3. Setups (strategy `setup`; all prices paise, all bars completed)
Bars: 1m and 5m from ticks (D82 rules), left-inclusive from 09:15 IST. A bar is usable after it closes.
A setup emits a **candidate** at a 1m close: `stop`, `target` (price) and family (`trend` or `range`).

| Kind | Params (default) | Candidate when |
|---|---|---|
| `opening_range_retest` | `rangeMinutes` 15, `retestBars` 3, `bufferAtr` 0.1, `targetR` 2 | a 1m close > OR high + buffer; then within the next `retestBars` bars one bar has low ≤ OR high and close > OR high + buffer. Stop = that bar's low |
| `prev_day_high_retest` | `retestBars` 3, `bufferAtr` 0.1, `targetR` 2 | same as above with the previous session's high |
| `inside_bar_continuation` | `expiryBars` 3, `bufferAtr` 0.1, `targetR` 2 | bar *i* inside bar *i−1* (strictly); within the next `expiryBars` bars a close > mother high + buffer. Stop = mother low. Nested inside bars do not reset expiry |
| `vwap_trend_pullback` | `proximityAtr` 0.3, `risingBars` 3, `expiryBars` 3, `targetR` 2 | VWAP of the last `risingBars` 5m closes strictly rising; a 1m low within ± `proximityAtr` × ATR of VWAP; within the next `expiryBars` bars a close > the pullback bar's high. Stop = lowest low since the pullback bar |
| `failed_breakout_reclaim` | `reclaimBars` 3, `minRewardR` 2, `exit` `vwap` \| `range_mid` | a 1m low < previous session low; within `reclaimBars` bars a close > that low. Stop = lowest low of the sequence. Target = VWAP (or stock opening-range midpoint) **frozen at entry**; needs ≥ `minRewardR` room |

Common: trend setups need upward context (last 5m close > VWAP and > EMA(`contextEmaPeriod`), EMA above its
value 3 bars ago) and the trend gate; `failed_breakout_reclaim` needs the range condition and the range gate.
VWAP = Kite's session average price on the tick (`ticks.avg_price_paise`); signal check uses bar VWAP.
A setup fires once per sequence; a new sequence may start after the old one fires or expires.
Target for `targetR` = first fill + `targetR` × (first fill − stop), fixed at the first fill.
`vwap_range_reversion` (guide ch. 14) is later, not in v1.

## 4. Buying rules (strategy `buying`)
| Kind | First buy | Add (at most one) |
|---|---|---|
| `single` | 100 % of the permitted quantity | none |
| `average_on_recovery` | `initialPercent` 70 | price ≤ first fill − `triggerAtr` 0.5 × ATR, then `confirmBars` 1 completed 1m close above the previous bar's high, within `expiryMinutes` 5 of the trigger |
| `add_to_winner` | `initialPercent` 70 | price ≥ first fill + `triggerR` 1 × R, then 1 completed close above the previous bar's high, within 5 min |

The stop and target never move. An add needs every §5 check again; its quantity is the smallest of
what the remaining position risk, pools, caps, cash and depth allow; zero → no add (logged).
Adds count against `addPoolPercent`; a position with two buys is still **one trade** (D53 counting).

## 5. Order of work at each moment (intraday simulator)
Signals come from 1m closes; ticks are read only for pending actions, open stops and marking.
1. Exits first: stop when a tick's best bid ≤ stop (fresh, within quote age); target when best bid ≥
   target; time exit at `maxHoldMinutes`; square-off at `squareOff`. Exit fills walk bid depth with the
   depth cap; the rest retries on later ticks. No bid by 15:29:59 → **unresolved**: valued at the last bid,
   flagged on the trade and the run (`incomplete`).
2. Daily loss: realised + open (best bid − estimated exit charges), checked at every fill and 1m close.
   At −`dailyLossPercent`: pending entries/adds cancelled, all positions exit, no new risk that day.
3. New candidates at one moment are ranked: earlier decision, then higher relative volume, then symbol.
4. Checks in this order; the first failure is the **skip reason**, all failures are kept:
   `entry_window`, `daily_shutdown`, `loss_pause`, `daily_new_limit`, `cooldown`, `market_gate`,
   `context`, `relative_volume`, `warmup`, `stop_too_narrow`, `stop_too_wide`, `reward_room`,
   `max_positions`, `stock_cap`, `sector_cap`, `initial_pool` / `add_pool`, `cash_reserve`, `open_risk`,
   `position_risk`, then at the attempt: `no_quote`, `stale_quote`, `wide_spread`, `spread_to_stop`,
   `too_little_depth`, `zero_qty`, `invalid_at_fill` (risk or reward recomputed at the real price fails).
5. Attempt at decision + delay: first tick with the needed side within `maxQuoteAgeMs`; buy walks the ask
   levels using ≤ `maxDepthPercent` of each, + slippage ticks × tick size; a level used by an earlier fill
   is not reused until a newer tick. Quantity = largest whole number passing every money check with the
   real charges for that quantity.
Equal times: exits before entries, then by symbol. Sector = the instrument's sector at the freeze.

## 6. Inputs and warm-up
- ATR: Wilder, `atrPeriod` 5m true ranges, previous sessions allowed. Relative volume = today's cumulative
  volume at the elapsed minute ÷ mean of the same minute over `volumeBaselineSessions` earlier sessions.
- Range condition: high − low of the last 6 completed 5m bars ≤ `rangeSpanAtr` × ATR.
- Trend gate: last completed 1m index close > index OR high (`indexRangeMinutes`). Range gate: index inside
  its OR and no decline veto. Missing index data = gate fails (`market_gate`).
- Warm-up (ATR, baselines, previous session high/low) may use Kite `history` candles; fills never do. The
  run lists which inputs came from history. Index from `index_ticks`; Kite 1m index candles only on a
  day without index ticks (listed on the run).

## 7. Data eligibility
Usable session: summarized, `longest_feed_gap_seconds` ≤ `maxSessionGapSeconds`, index ticks or Kite
fallback present. A stock with no ticks that day is skipped for the day. Tick size per instrument from
Kite (`tick_size_paise`). First-round universe: NIFTY 100 members on the freeze date, stored on the experiment.

## 8. Experiments
Frozen plan = profile version + strategy versions + universe + blocks + hash. It creates every variant ×
`base`/`stress` run of a block. Blocks: **development** (1 Oct 2026 → the freeze), **validation** (next 20
usable sessions), **final** (next 20). Final results stay hidden until the shortlist and pass thresholds are
written on the experiment; each view is logged. Experiment runs cannot be deleted. Outcome per variant:
`reject`, `inconclusive`, `revise` (new version, new blocks), `continue` (never automatic live trading).
Order: 5 setups × `single` first; buying rules only after the 12 mechanics cases (§10) pass.

## 9. Signal check on history
The intraday simulator runs the same setups on Kite 1m candles: fills at the next 1m open ± slippage
ticks, no spread/depth/age checks (reported as "not tested"), VWAP from bars. Labelled **Signal check**,
never pooled with recorded results.

## 10. Mechanics cases (engine tests on synthetic ticks)
No signal → 0 trades · missing ask → skipped entry · stop before an add confirmation → add cancelled · add
lowers the average but its extra risk breaches → rejected · winner add cut by the fixed stop · two stocks
compete for the add pool → priority, no overspend · 4th stock blocked by `maxPositions` · late quote changes
risk → `invalid_at_fill` · partial fill keeps the smaller quantity and charges · no bid at session end →
unresolved, no invented profit · two buys = one trade · missing warm-up → `warmup`, not a wrong level.

## 11. Reports (intraday runs)
Net P&L, expectancy (₹ and R), win rate, profit factor, max drawdown, worst day, zero-trade days, skip
reasons (first + all), unresolved positions, capital and risk use, base vs stress, add impact vs the
matching `single` run. Small samples say so; no annualised ratios on fewer than 60 sessions.
