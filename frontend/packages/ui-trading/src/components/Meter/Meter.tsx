import * as React from "react";
import { cn } from "@nova/ui-core";

export interface MeterProps extends React.HTMLAttributes<HTMLDivElement> {
  label: React.ReactNode;
  value: number;
  max: number;
  valueText?: React.ReactNode;
  warnAt?: number;
  dangerAt?: number;
}

export const Meter = React.forwardRef<HTMLDivElement, MeterProps>(
  ({ label, value, max, valueText, warnAt = 0.8, dangerAt = 0.95, className, ...props }, ref) => {
    const fraction = Math.max(0, Math.min(1, max > 0 ? value / max : 0));
    const percent = fraction * 100;

    const fillColor =
      fraction >= dangerAt ? "bg-loss" : fraction >= warnAt ? "bg-warning" : "bg-action";

    const displayValueText = valueText !== undefined ? valueText : `${value} / ${max}`;

    return (
      <div ref={ref} className={cn("w-full", className)} {...props}>
        <div className="flex items-center justify-between gap-2 mb-1.5 text-body-sm">
          <span className="font-medium text-text-primary">{label}</span>
          <span className="font-mono text-number-sm text-text-muted tabular-nums">
            {displayValueText}
          </span>
        </div>

        <div
          role="meter"
          aria-valuemin={0}
          aria-valuemax={max}
          aria-valuenow={value}
          aria-valuetext={typeof displayValueText === "string" ? displayValueText : undefined}
          className="w-full bg-bg-raised h-2 rounded-xs overflow-hidden"
        >
          <div
            className={cn("h-full transition-all duration-300 rounded-xs", fillColor)}
            style={{ width: `${percent}%` }}
          />
        </div>
      </div>
    );
  },
);

Meter.displayName = "Meter";
