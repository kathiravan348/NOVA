import type { BacktestMetrics, Segment } from "@nova/contracts";
import { StatCard } from "@nova/ui-core";
import { PnLCard, formatInr, formatPercent } from "@nova/ui-trading";

export interface MetricsGridProps {
  metrics: BacktestMetrics;
  /** The run's benchmark index, for the Benchmark return caption (D62). */
  benchmark?: string | null;
  /** The strategy's segment: intraday runs have no tax estimate (D62 (6)). */
  segment?: Segment;
}

const mono = (text: string) => <span className="font-mono">{text}</span>;
const DASH = mono("—");

/** "—" with a short caption for a number the run does not have; never 0. */
function orDash(value: number | null | undefined, show: (v: number) => string) {
  return value === null || value === undefined ? DASH : mono(show(value));
}

/**
 * Backtest metrics as cards; every value comes straight from the result (no client maths).
 * The second row holds the D62 numbers, "—" for runs from before them.
 */
export function MetricsGrid({ metrics: m, benchmark, segment }: MetricsGridProps) {
  const signed = (v: number) => formatPercent(v, { signed: true });
  const taxCaption =
    m.estimatedTaxPaise !== null && m.estimatedTaxPaise !== undefined
      ? `Estimated tax ${formatInr(m.estimatedTaxPaise, { decimals: 0 })}`
      : segment === "equity_intraday"
        ? "No tax estimate for intraday"
        : "Not estimated for this run";
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <PnLCard
          label="Net P&L"
          paise={m.netPnlPaise}
          percent={m.returnPercent}
          className="col-span-2 sm:col-span-1"
        />
        <PnLCard label="Gross P&L" paise={m.grossPnlPaise} className="col-span-2 sm:col-span-1" />
        <StatCard label="Charges" value={mono(formatInr(m.chargesPaise))} />
        <StatCard label="CAGR" value={mono(signed(m.cagrPercent))} />
        <StatCard
          label="Max drawdown"
          value={mono(formatPercent(m.maxDrawdownPercent))}
          caption="Largest peak-to-trough fall"
        />
        <StatCard label="Sharpe" value={mono(m.sharpe.toFixed(2))} />
        <StatCard
          label="Win rate"
          value={mono(formatPercent(m.winRatePercent, { decimals: 0 }))}
          caption={`${m.winCount} of ${m.tradeCount} trades`}
        />
        <StatCard
          label="Trades"
          value={mono(String(m.tradeCount))}
          caption={`${m.winCount} won · ${m.lossCount} lost`}
        />
      </div>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
        <StatCard
          label="After-tax CAGR"
          value={orDash(m.afterTaxCagrPercent, signed)}
          caption={taxCaption}
        />
        <StatCard
          label="Benchmark return"
          value={orDash(m.benchmarkReturnPercent, signed)}
          caption={
            m.benchmarkReturnPercent === null || m.benchmarkReturnPercent === undefined
              ? "No benchmark prices"
              : `${benchmark ?? "Benchmark"}, same period`
          }
        />
        <StatCard
          label="Time invested"
          value={orDash(m.exposurePercent, (v) => formatPercent(v, { decimals: 0 }))}
          caption="Days with money in a trade"
        />
        <StatCard
          label="Avg days held"
          value={orDash(m.avgHoldDays, (v) => v.toFixed(1))}
          caption="Per trade"
        />
        <StatCard
          label="Profit factor"
          value={orDash(m.profitFactor, (v) => v.toFixed(2))}
          caption="Won ÷ lost"
        />
        <StatCard
          label="Calmar"
          value={orDash(m.calmar, (v) => v.toFixed(2))}
          caption="CAGR ÷ max drawdown"
        />
        {m.spreadCostPaise !== null && m.spreadCostPaise !== undefined && (
          <StatCard
            label="Spread cost"
            value={mono(formatInr(m.spreadCostPaise))}
            caption="Paid at the ask and bid vs the last price"
          />
        )}
      </div>
    </div>
  );
}
