import * as React from "react";
import { cn } from "@nova/ui-core";
import { formatInr, formatPercent } from "../../format/money";

export interface PnLTextProps extends React.HTMLAttributes<HTMLSpanElement> {
  paise: number;
  percent?: number;
  decimals?: number;
}

export const PnLText = React.forwardRef<HTMLSpanElement, PnLTextProps>(
  ({ paise, percent, decimals = 2, className, ...props }, ref) => {
    const colorClass = paise > 0 ? "text-profit" : paise < 0 ? "text-loss" : "text-text-primary";

    const inrText = formatInr(paise, { signed: true, decimals });
    const percentText =
      percent !== undefined ? ` (${formatPercent(percent, { signed: true })})` : "";

    return (
      <span
        ref={ref}
        className={cn("font-mono text-number tabular-nums", colorClass, className)}
        {...props}
      >
        {inrText}
        {percentText}
      </span>
    );
  },
);

PnLText.displayName = "PnLText";
