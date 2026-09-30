import * as React from "react";
import { ChevronFirst, ChevronLast, ChevronLeft, ChevronRight } from "lucide-react";
import { IconButton } from "../IconButton/IconButton";
import { Input } from "../Input/Input";
import { Select } from "../Select/Select";

export interface PagerProps {
  /** Current page, starting at 1. */
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  pageSizes?: number[];
  loading?: boolean;
}

/** Controlled pagination for local tables and server lists; fetching belongs to the caller. */
export function Pager({
  page,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
  pageSizes = [25, 50, 100, 200],
  loading = false,
}: PagerProps): React.ReactElement {
  const pageCount = Math.ceil(total / pageSize);
  const currentPage = Math.max(1, Math.min(page, pageCount || 1));
  const [draft, setDraft] = React.useState(String(currentPage));
  React.useEffect(() => setDraft(String(currentPage)), [currentPage, pageSize, total]);
  const disabled = loading || total === 0;
  const start = (currentPage - 1) * pageSize + 1;
  const end = Math.min(currentPage * pageSize, total);
  const format = (value: number) => value.toLocaleString("en-IN");
  const sizes = [...new Set([...pageSizes, pageSize])].sort((a, b) => a - b);

  const jump = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    const value = Number(draft);
    if (disabled || draft.trim() === "" || !Number.isFinite(value)) {
      setDraft(String(currentPage));
      return;
    }
    const next = Math.max(1, Math.min(Math.trunc(value), pageCount));
    setDraft(String(next));
    onPageChange(next);
  };

  return (
    <nav
      aria-label="Pagination"
      aria-busy={loading}
      className="flex flex-col gap-3 py-4 md:flex-row md:items-center md:justify-between"
    >
      <div className="flex items-center justify-between gap-3 md:contents">
        <div className="min-w-0 text-body-sm text-text-muted" role="status">
          <p className="font-mono">
            <span>
              {total === 0
                ? "No entries"
                : `Showing ${format(start)}–${format(end)} of ${format(total)}`}
            </span>
            {total > 0 && " entries"}
          </p>
          <p className="font-mono">
            Page {total === 0 ? 0 : currentPage} of {format(pageCount)}
          </p>
        </div>
        <Select
          label="Rows per page"
          containerClassName="shrink-0"
          className="font-mono"
          value={String(pageSize)}
          options={sizes.map((size) => ({ value: String(size), label: format(size) }))}
          disabled={disabled}
          onChange={(event) => {
            onPageSizeChange(Number(event.target.value));
            onPageChange(1);
          }}
        />
      </div>
      <div className="flex items-center justify-between gap-2 md:justify-end">
        <IconButton
          aria-label="First page"
          icon={<ChevronFirst className="h-4 w-4" />}
          variant="secondary"
          disabled={disabled || currentPage === 1}
          onClick={() => onPageChange(1)}
        />
        <IconButton
          aria-label="Previous page"
          icon={<ChevronLeft className="h-4 w-4" />}
          variant="secondary"
          disabled={disabled || currentPage === 1}
          onClick={() => onPageChange(currentPage - 1)}
        />
        <Input
          label={<span className="sr-only">Jump to page</span>}
          containerClassName="w-20"
          type="number"
          inputMode="numeric"
          numeric
          min={1}
          max={pageCount || 1}
          step={1}
          title="Enter a page number and press Enter"
          value={draft}
          disabled={disabled}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={jump}
          onBlur={() => setDraft(String(currentPage))}
        />
        <IconButton
          aria-label="Next page"
          icon={<ChevronRight className="h-4 w-4" />}
          variant="secondary"
          disabled={disabled || currentPage >= pageCount}
          onClick={() => onPageChange(currentPage + 1)}
        />
        <IconButton
          aria-label="Last page"
          icon={<ChevronLast className="h-4 w-4" />}
          variant="secondary"
          disabled={disabled || currentPage >= pageCount}
          onClick={() => onPageChange(pageCount)}
        />
      </div>
    </nav>
  );
}
