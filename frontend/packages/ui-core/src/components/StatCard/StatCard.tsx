import * as React from "react";
import { Card, type CardProps } from "../Card/Card";
import { Skeleton } from "../Skeleton/Skeleton";
import { cn } from "../../lib/cn";

export type StatCardCaptionTone = "neutral" | "positive" | "negative";

const captionToneClasses: Record<StatCardCaptionTone, string> = {
  neutral: "text-text-muted",
  positive: "text-profit",
  negative: "text-loss",
};

export interface StatCardProps extends Omit<CardProps, "title" | "children"> {
  label: React.ReactNode;
  value: React.ReactNode;
  caption?: React.ReactNode;
  captionTone?: StatCardCaptionTone;
  loading?: boolean;
}

export const StatCard = React.forwardRef<HTMLDivElement, StatCardProps>(
  (
    { className, label, value, caption, captionTone = "neutral", loading = false, ...props },
    ref,
  ) => {
    return (
      <Card ref={ref} className={cn("flex flex-col justify-between", className)} {...props}>
        {loading ? (
          <div className="flex flex-col gap-2">
            <Skeleton className="h-3.5 w-24" />
            <Skeleton className="h-7 w-36 my-0.5" />
            {caption !== undefined && <Skeleton className="h-3.5 w-28" />}
          </div>
        ) : (
          <div className="flex flex-col">
            <span className="font-sans text-label uppercase font-semibold text-text-muted select-none">
              {label}
            </span>
            <div className="font-mono text-number-lg font-medium text-text-primary mt-1">
              {value}
            </div>
            {caption !== undefined && (
              <div className={cn("font-sans text-body-sm mt-1.5", captionToneClasses[captionTone])}>
                {caption}
              </div>
            )}
          </div>
        )}
      </Card>
    );
  },
);

StatCard.displayName = "StatCard";
