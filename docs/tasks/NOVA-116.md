# NOVA-116 — Engine: benchmark, new metrics, year table, tax estimate (D62, migration 0018)

**Status:** planned · **Owner:** — · **Branch:** task/NOVA-116 · **Depends on:** NOVA-112, NOVA-113, NOVA-114, NOVA-115 · **Merge after:** NOVA-124 (migration order)

## Goal
Every new run fills the D62 (6) numbers that NOVA-114 added to the contracts: the benchmark curve and return, time invested,
average days held, profit factor, Calmar, the estimated tax and after-tax result, and the year-by-year table. Old runs show
null / `[]`.

## Read first
- `AGENTS.md`; `docs/DECISIONS.md` D42, D45, D60, D62; `docs/guides/DATABASE.md` (backtest_results); every file under Files

## Files
Create:
- `backend/services/backtest/src/nova_backtest/{benchmark,tax,years}.py`
- `backend/services/backtest/tests/{test_benchmark,test_tax,test_years}.py`
- `backend/libs/nova_db/src/nova_db/migrations/versions/rev0018_result_metrics.py` (next free number; 0017 is NOVA-124's)
Modify:
- `backend/services/backtest/src/nova_backtest/{metrics,strategy_engine,convert,versions}.py`
- `backend/services/backtest/tests/{test_metrics,test_engine,test_api,test_versions}.py`
- `backend/libs/nova_db/src/nova_db/models/backtest.py`; `docs/guides/{DATABASE,API}.md`

## Build
1. Migration: `backtest_results` gets these nullable columns:
   - `benchmark_return_percent`, `benchmark_cagr_percent`, `exposure_percent`, `avg_hold_days`, `profit_factor`, `calmar`,
     `after_tax_cagr_percent` (all Numeric)
   - `estimated_tax_paise`, `after_tax_net_pnl_paise` (BigInteger)
   - `years` (JSONB, not null, default `'[]'`)

   Checks: exposure 0–100; tax ≥ 0.
2. `benchmark.py`: when `run.benchmark` is set, read that index's **1d** candles (`symbol` = index name, NOVA-113) over the
   period. Each equity point gets `benchmark_paise = initial × index close on or before that date ÷ first close on/after
   the start` (half-up). No index candles → nulls, and the run does not fail.
3. `metrics.py`:
   - `benchmarkReturnPercent` / `benchmarkCagrPercent` from the benchmark curve.
   - `exposurePercent`: % of equity dates on which any trade was open, counting its entry date through its exit date.
   - `avgHoldDays`: mean of (exit − entry) in days, 2 decimals.
   - `profitFactor`: net wins ÷ |net losses|; null with no losing trade.
   - `calmar`: CAGR ÷ |max drawdown|; null when the drawdown is 0.
4. `tax.py` (equity delivery only; intraday → all tax fields null). Group trades by the Indian financial year of their exit
   (1 Apr – 31 Mar).
   - Gain = gross − (charges − STT); STT cannot be deducted.
   - Long-term if held > 365 days, counted from the first buy.
   - Per year: short-term losses offset long-term gains, long-term losses offset only long-term gains, nothing carries forward.
   - Tax = (short-term × 20% + max(long-term − ₹1,25,000, 0) × 12.5%) × 1.04, half-up paise.
   - `estimatedTaxPaise` is the sum over years. `afterTaxNetPnlPaise` = net − tax. `afterTaxCagrPercent` is the CAGR of
     initial + after-tax net (tax taken at the end; say so in a docstring).
5. `years.py`: 12-month blocks from `date_from` (the last one may be short), each clipped to `date_to`.
   - Start = the previous block's end equity (the first block starts at the initial capital); end = the last equity point in
     the block.
   - `returnPercent`, `profitPaise`, `maxDrawdownPercent` (the peak starts at the start equity), and `benchmarkPercent` or null.
   - The profits add up to the net P&L.
6. `strategy_engine.py` saves everything. `convert.metrics_of` / `result_contract` send it. `versions.trim_older_versions`
   keeps the new columns and `years`. Guides: the DATABASE columns and migration header; API result fields. Update "State as of" in both.

## Acceptance checks
- [ ] Tax tests:
  - an intraday run gives nulls
  - a 400-day winner is long-term
  - ₹1,00,000 of long-term gain gives 0 tax
  - a short-term loss offsets a long-term gain in the same year
  - separate years do not offset each other
  - STT is not deducted
- [ ] Years: a 5-year run has 5 rows and a 26-month run has 3; profits add up to the net P&L; drawdown per block.
- [ ] Benchmark: the curve starts at the initial capital. With no index candles you get nulls and the run completes.
- [ ] Old results read back with nulls and `years: []`. Migration upgrade and downgrade pass. `backend-check` passes.

## Out of scope
- New indicators (NOVA-127); regime and rotation (NOVA-117); the results screens (NOVA-120); tax carry-forward and lot-wise FIFO.

## Questions
_(implementer writes here if blocked)_

## Handoff
_(implementer, ≤ 20 lines — see `docs/templates/HANDOFF.md`)_

## Review
_(Claude, ≤ 20 lines — see `docs/templates/REVIEW.md`)_
