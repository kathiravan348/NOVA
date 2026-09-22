import * as React from "react";
import { format, parseISO } from "date-fns";
import type { EquityPoint } from "@nova/contracts";
import { formatInr } from "../../format/money";

export interface EquityCurveTooltipProps {
  point?: EquityPoint;
}

export function EquityCurveTooltip({ point }: EquityCurveTooltipProps): React.ReactElement | null {
  if (!point) return null;
  return (
    <div className="bg-bg-raised border border-border-default rounded-md p-3 text-body-sm">
      <p className="text-text-muted mb-1">{format(parseISO(point.date), "d MMM yyyy")}</p>
      <p className="flex justify-between gap-4">
        <span className="text-text-secondary">Strategy</span>
        <span className="font-mono text-text-primary">
          {formatInr(point.equityPaise, { decimals: 0 })}
        </span>
      </p>
      {point.benchmarkPaise !== null && (
        <p className="flex justify-between gap-4">
          <span className="text-text-secondary">NIFTY 50</span>
          <span className="font-mono text-text-primary">
            {formatInr(point.benchmarkPaise, { decimals: 0 })}
          </span>
        </p>
      )}
    </div>
  );
}
