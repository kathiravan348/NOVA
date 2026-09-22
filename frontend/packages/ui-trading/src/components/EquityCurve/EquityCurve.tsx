import * as React from "react";
import { format, parseISO } from "date-fns";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { EquityPoint } from "@nova/contracts";
import { Skeleton, cn } from "@nova/ui-core";
import { formatInr, formatInrCompact } from "../../format/money";
import { EquityCurveTooltip } from "./EquityCurveTooltip";

export interface EquityCurveProps {
  points: EquityPoint[];
  initialCapitalPaise?: number;
  /** Fixed height in px. Default: 220 below `md`, 280 from `md`. */
  height?: number;
  loading?: boolean;
  emptyText?: string;
  ariaLabel: string;
  className?: string;
}

const TICK = { fill: "var(--text-muted)", fontFamily: "var(--font-mono)", fontSize: 11 };

function LegendItem({ label, dashed }: { label: string; dashed?: boolean }): React.ReactElement {
  return (
    <span className="inline-flex items-center gap-2">
      <span
        aria-hidden="true"
        className={cn(
          "inline-block w-4 border-t-2",
          dashed ? "border-dashed border-chart-benchmark" : "border-action",
        )}
      />
      {label}
    </span>
  );
}

export function EquityCurve({
  points,
  initialCapitalPaise,
  height,
  loading = false,
  emptyText = "No equity data",
  ariaLabel,
  className,
}: EquityCurveProps): React.ReactElement {
  const sizeClass = height === undefined ? "h-[220px] md:h-[280px]" : undefined;
  const sizeStyle = height === undefined ? undefined : { height };

  if (loading) {
    return <Skeleton className={cn("w-full", sizeClass, className)} style={sizeStyle} />;
  }

  if (points.length === 0) {
    return (
      <div
        className={cn(
          "flex w-full items-center justify-center text-body-sm text-text-muted",
          sizeClass,
          className,
        )}
        style={sizeStyle}
      >
        {emptyText}
      </div>
    );
  }

  const first = points[0]!;
  const last = points[points.length - 1]!;
  const hasBenchmark = points.some((p) => p.benchmarkPaise !== null);
  // One tick per month (its first point), so labels never repeat. Runs shorter than
  // three months use Recharts' own ticks labelled by day instead.
  const monthTicks = points
    .filter((p, i) => i === 0 || p.date.slice(0, 7) !== points[i - 1]!.date.slice(0, 7))
    .map((p) => p.date);
  const byMonth = monthTicks.length >= 3;

  return (
    <div className={cn("w-full min-w-0", className)}>
      <div className="mb-2 flex gap-4 text-body-sm text-text-muted">
        <LegendItem label="Strategy" />
        {hasBenchmark && <LegendItem label="NIFTY 50" dashed />}
      </div>
      <div role="img" aria-label={ariaLabel} className={cn("w-full", sizeClass)} style={sizeStyle}>
        <p className="sr-only">
          From {format(parseISO(first.date), "d MMM yyyy")} to{" "}
          {format(parseISO(last.date), "d MMM yyyy")}, equity{" "}
          {formatInr(first.equityPaise, { decimals: 0 })} →{" "}
          {formatInr(last.equityPaise, { decimals: 0 })}
        </p>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={points} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} stroke="var(--border-default)" />
            <XAxis
              dataKey="date"
              ticks={byMonth ? monthTicks : undefined}
              tick={TICK}
              tickLine={false}
              axisLine={{ stroke: "var(--border-default)" }}
              minTickGap={32}
              tickFormatter={(d: string) => format(parseISO(d), byMonth ? "MMM yy" : "d MMM")}
            />
            <YAxis
              tick={TICK}
              tickLine={false}
              axisLine={false}
              width={64}
              domain={["auto", "auto"]}
              tickFormatter={(v: number) => formatInrCompact(v)}
            />
            <Tooltip
              cursor={{ stroke: "var(--border-default)" }}
              content={(props) => (
                <EquityCurveTooltip
                  point={props.active ? (props.payload?.[0]?.payload as EquityPoint) : undefined}
                />
              )}
            />
            {initialCapitalPaise !== undefined && (
              <ReferenceLine
                y={initialCapitalPaise}
                stroke="var(--text-muted)"
                strokeDasharray="2 4"
              />
            )}
            {hasBenchmark && (
              <Line
                type="monotone"
                dataKey="benchmarkPaise"
                name="NIFTY 50"
                stroke="var(--chart-benchmark)"
                strokeWidth={1.5}
                strokeDasharray="4 4"
                dot={false}
                isAnimationActive={false}
              />
            )}
            <Line
              type="monotone"
              dataKey="equityPaise"
              name="Strategy"
              stroke="var(--action)"
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
