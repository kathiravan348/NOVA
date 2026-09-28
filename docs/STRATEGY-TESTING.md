# Strategy research and testing protocol (D73)

State as of 2026-09-28 — NOVA-144. The Library supplies 100 fixed candidates, not measured winners.
This document describes a manual research workflow using existing backtests. There is no automatic
search, walk-forward scheduler, success score or execution-cost stress engine.

## 1. Define success before looking at results

Choose a trading style, comparable universe, common dates, capital and drawdown budget. Separate
intraday, overnight swing and daily position/rotation comparisons. Candle size is not holding time:
15m delivery can hold for days; intraday closes each session. HOLD counts bars, not calendar days.

Record each exact strategy version, candle size, settings, dates, stocks, benchmark and trial number.
Treat timeframe, stop and indicator variants as additional trials. Keep a record of failures too.
Win rate alone is insufficient: 9 wins of ₹100 and one loss of ₹2,000 lose ₹1,100 before charges.

## 2. Check that the data supports the experiment

Download 1m for every intraday-chart strategy, including overnight swing on 15m/30m/1h.
The engine derives 3m–1h from 1m; daily entries require 1d separately. Daily regime filters require
the index's daily candles. Check Stored data, gaps, broker-unavailable dates and skipped symbols.
Warm-up data is needed before the scored period. New presets use NIFTY 50 as both universe and
benchmark, ₹10,00,000 and 2023-01-02–2024-12-31. Those dates are discovery defaults, not evidence.

Today's index membership is used historically. Delisted/excluded stocks can be absent; later
listings join when prices start. This survivorship limitation remains even if all stored candles
are complete. A current-members buy-and-hold portfolio is not the historical index return.

## 3. Use chronological windows and freeze the rules

1. Discovery: use 2023-01-02–2024-12-31 for the new presets; decide rules and record every trial.
2. Validation: freeze those rules, then test 2025-01-01–2026-09-25 with the same universe and capital.
3. Earlier stress: use available 2020–2022 history to inspect different conditions, without
   changing the rules in response and continuing to call that period unseen.
4. Rolling checks: inspect successive common yearly windows. Each decision must use only prior
   windows; report all subsequent windows, including losses. Results of overlapping windows are
   related observations, not independent confirmations.
5. Final evaluation: freeze a shortlist before testing a genuinely untouched period. If a period
   has already informed strategy selection, call it retrospective validation. Repeatedly tuning
   against the validation period consumes it. No historical split guarantees future performance.

The original 60 retain D62's suggested periods. For direct comparisons, override defaults so the
candidate runs use identical windows. Use saved versions to identify the exact run settings;
save full reports separately when needed because older run versions keep only their numbers.

## 4. Compare results after costs and alongside risk

Use the matching universe index as benchmark and compare CAGR over identical periods. For the
new NIFTY 50 presets this is NIFTY 50. A custom basket needs a clearly stated comparable index;
an index benchmark is a reference, not the same cash exposure or trading objective.

Review net P&L after charges, CAGR, max drawdown, profit factor, trade count, win rate, Sharpe,
Calmar and Year by year. Derive expectancy from trades as average net profit/loss per closed
trade; the screen does not currently show an expectancy field. Treat undefined ratios as
undefined, not perfect results. Inspect losing streaks, average hold, exposure and the share
of profit from the best three stocks using the per-symbol report. Few trades or one lucky stock
mean weak evidence, even with attractive CAGR.

D62's delivery aspirations remain: after-tax CAGR ≥25%, drawdown no worse than −25%, no year
below −5%, ≥40 trades, top three stocks <50% of profit, validation CAGR ≥60% of discovery CAGR.
These are research screens, not guarantees or universal ranking thresholds. A ratio with zero
or negative discovery CAGR is not evidence of retention. Intraday tax is not estimated, so its
after-tax qualification cannot be verified using the current report. Long-hold strategies with
few trades should be marked as insufficient evidence rather than made to trade merely to pass.

## 5. State execution limits before choosing a winner

The engine evaluates completed candles, then fills at the next open. Stops/targets use candle
ranges, with stop priority when both occur. Overnight gaps can exceed a stop. Charges are
included, with dated schedules; older rates include the documented approximation (D66).
Slippage, bid/ask spread, market impact and partial fills are not simulated. Daily total returns
and corporate-action handling must also be checked before strong investment conclusions.

MIS square-off is represented with available chart bars; a 30m/1h test cannot recreate the exact
15:20 price. The final hourly session bucket can be only 15 minutes. One-minute experiments
are particularly sensitive to omitted execution costs. Stress costs before relying on an
intraday result; implementing reliable stress results requires a separate engine task.

## 6. Report a shortlist and allow no winner

Keep candidates that remain credible across chronological windows, common universes and nearby
predeclared settings. Report a shortlist by style with returns, drawdown, sample size and limits.
Do not label a strategy best for every market or claim a measured success rate without tests.
Adding presets, passing synthetic tests and successfully installing them establish software
behavior, not profitability. No candidate passing is a valid research outcome. Paper trading
and live trading remain later phases; this task adds no orders or real-money actions.

## Research sources

- [NSE momentum methodology](https://www.niftyindices.com/Factsheet/Factsheet_Nifty200_Momentum30.pdf)
  uses volatility-adjusted six- and twelve-month returns. Library presets are distinct hypotheses,
  not replicas of the index's weighting and rebalance rules.
- [NSE low-volatility index](https://www.niftyindices.com/indices/equity/strategy-indices/nifty-100-low-volatility)
  illustrates volatility selection. Our equal weighting and trend filters differ.
- [Bailey et al., The Probability of Backtest Overfitting](https://www.davidhbailey.com/dhbpapers/backtest-prob.pdf)
  explains why selecting among many historical trials can produce apparent winners. This
  practical protocol does not implement that paper's statistical framework.
