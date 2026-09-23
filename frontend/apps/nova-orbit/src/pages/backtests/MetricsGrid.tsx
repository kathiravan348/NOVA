import type { BacktestMetrics } from "@nova/contracts";
import { StatCard } from "@nova/ui-core";
import { PnLCard, formatInr, formatPercent } from "@nova/ui-trading";

export interface MetricsGridProps {
  metrics: BacktestMetrics;
}

const mono = (text: string) => <span className="font-mono">{text}</span>;

/** Backtest metrics as cards; every value comes straight from the result (no client maths). */
export function MetricsGrid({ metrics: m }: MetricsGridProps) {
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      <PnLCard
        label="Net P&L"
        paise={m.netPnlPaise}
        percent={m.returnPercent}
        className="col-span-2 sm:col-span-1"
      />
      <PnLCard label="Gross P&L" paise={m.grossPnlPaise} className="col-span-2 sm:col-span-1" />
      <StatCard label="Charges" value={mono(formatInr(m.chargesPaise))} />
      <StatCard label="CAGR" value={mono(formatPercent(m.cagrPercent, { signed: true }))} />
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
  );
}
