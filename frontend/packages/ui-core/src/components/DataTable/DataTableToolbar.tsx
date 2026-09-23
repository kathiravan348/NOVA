import * as React from "react";
import { Search } from "lucide-react";
import { Input } from "../Input/Input";

export interface DataTableSearch<TData> {
  label: string;
  placeholder?: string;
  getText: (row: TData) => string;
}

export interface DataTableToolbarProps {
  searchLabel?: string;
  searchPlaceholder?: string;
  query: string;
  onQueryChange: (query: string) => void;
  selectedCount?: number;
  children?: React.ReactNode;
}

export function DataTableToolbar({
  searchLabel,
  searchPlaceholder,
  query,
  onQueryChange,
  selectedCount,
  children,
}: DataTableToolbarProps): React.ReactElement {
  return (
    <div className="flex flex-col gap-3 md:flex-row md:flex-wrap md:items-end">
      {searchLabel !== undefined && (
        <Input
          type="search"
          label={searchLabel}
          placeholder={searchPlaceholder}
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          leading={<Search className="h-4 w-4" />}
          containerClassName="md:w-72"
        />
      )}
      {children}
      {selectedCount !== undefined && (
        <p className="text-body-sm text-text-muted md:ml-auto md:pb-2" aria-live="polite">
          <span className="font-mono text-number text-text-primary">{selectedCount}</span> selected
        </p>
      )}
    </div>
  );
}
