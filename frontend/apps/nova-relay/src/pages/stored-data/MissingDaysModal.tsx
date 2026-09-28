import type { CoverageQuery, CoverageRow } from "@nova/contracts";
import { Button, Modal, Skeleton } from "@nova/ui-core";
import { useCoverageDetail } from "@nova/services";
import { QueryError } from "../../components/QueryState";
import { formatCalendarDate, formatPeriod } from "../../lib/format";

export interface MissingDaysModalProps {
  row: CoverageRow | null;
  query: CoverageQuery;
  onClose: () => void;
  onDownload: (rows: CoverageRow[]) => void;
}

/** One stock's stored range and missing trading days in the period (D63). */
export function MissingDaysModal({ row, query, onClose, onDownload }: MissingDaysModalProps) {
  const detail = useCoverageDetail(row?.symbol ?? null, query);
  const range =
    row?.firstDay && row.lastDay
      ? `Stored from ${formatCalendarDate(row.firstDay)} to ${formatCalendarDate(row.lastDay)}.`
      : "Nothing stored yet.";
  return (
    <Modal
      open={row !== null}
      onOpenChange={(open) => !open && onClose()}
      title={row ? `${row.symbol}: missing days` : ""}
      description={range}
      footer={
        <>
          <Button type="button" variant="secondary" onClick={onClose}>
            Close
          </Button>
          {row && row.status !== "complete" && row.status !== "unavailable" && (
            <Button type="button" onClick={() => onDownload([row])}>
              Download missing
            </Button>
          )}
        </>
      }
    >
      {!!detail.data?.unavailableDays && (
        <p className="mb-4 text-body-sm text-text-muted">
          {detail.data.unavailableDays} missing days were checked successfully but the broker
          returned no usable candle. See Unavailable data for exact dates and Check again.
        </p>
      )}
      {detail.isPending ? (
        <Skeleton className="h-16 w-full" />
      ) : detail.isError ? (
        <QueryError error={detail.error} onRetry={() => void detail.refetch()} />
      ) : detail.data.missing.length === 0 ? (
        <p className="text-body text-text-secondary">No missing trading days in this period.</p>
      ) : (
        <ul aria-label="Missing days" className="flex flex-col gap-1 text-body text-text-primary">
          {detail.data.missing.map((m) => (
            <li key={m.from} className="flex justify-between gap-4">
              <span>
                {m.from === m.to ? formatCalendarDate(m.from) : formatPeriod(m.from, m.to)}
              </span>
              <span className="font-mono text-number text-text-muted">
                {m.days} {m.days === 1 ? "day" : "days"}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}
