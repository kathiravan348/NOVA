import * as React from "react";
import type { Charges } from "@nova/contracts";
import { Card, Skeleton, cn } from "@nova/ui-core";
import { formatInr } from "../../format/money";

export interface ChargesBreakdownProps {
  charges: Charges;
  title?: React.ReactNode;
  hideZero?: boolean;
  loading?: boolean;
  className?: string;
}

interface ChargeRow {
  label: string;
  amount: number;
}

export function ChargesBreakdown({
  charges,
  title = "Charges",
  hideZero = false,
  loading = false,
  className,
}: ChargesBreakdownProps): React.ReactElement {
  const allRows: ChargeRow[] = [
    { label: "Brokerage", amount: charges.brokeragePaise },
    { label: "STT/CTT", amount: charges.sttPaise },
    { label: "Exchange txn", amount: charges.exchangeTxnPaise },
    { label: "SEBI fee", amount: charges.sebiFeePaise },
    { label: "Stamp duty", amount: charges.stampDutyPaise },
    { label: "GST", amount: charges.gstPaise },
    { label: "DP charges", amount: charges.dpPaise },
  ];

  const visibleRows = hideZero ? allRows.filter((row) => row.amount > 0) : allRows;

  return (
    <Card title={title} className={cn("max-w-md", className)}>
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex justify-between items-center">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-4 w-20" />
            </div>
          ))}
          <div className="border-t border-border-default pt-2 mt-2 flex justify-between items-center">
            <Skeleton className="h-5 w-20" />
            <Skeleton className="h-5 w-24" />
          </div>
        </div>
      ) : (
        <dl className="space-y-2">
          {visibleRows.map((row) => (
            <div key={row.label} className="flex items-center justify-between text-body-sm">
              <dt className="text-text-muted">{row.label}</dt>
              <dd className="font-mono text-number text-right text-text-primary">
                {formatInr(row.amount)}
              </dd>
            </div>
          ))}

          <div className="flex items-center justify-between border-t border-border-default pt-2 mt-3 text-body font-semibold">
            <dt className="text-text-primary">Total</dt>
            <dd className="font-mono text-number text-right text-loss">
              {formatInr(charges.totalPaise)}
            </dd>
          </div>
        </dl>
      )}
    </Card>
  );
}
