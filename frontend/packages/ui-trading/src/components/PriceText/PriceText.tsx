import * as React from "react";
import { cn } from "@nova/ui-core";
import { formatInr, formatPrice } from "../../format/money";

export interface PriceTextProps extends React.HTMLAttributes<HTMLSpanElement> {
  paise: number;
  currency?: boolean;
}

export const PriceText = React.forwardRef<HTMLSpanElement, PriceTextProps>(
  ({ paise, currency = false, className, ...props }, ref) => {
    const formatted = currency ? formatInr(paise, { decimals: 2 }) : formatPrice(paise);

    return (
      <span ref={ref} className={cn("font-mono text-number tabular-nums", className)} {...props}>
        {formatted}
      </span>
    );
  },
);

PriceText.displayName = "PriceText";
