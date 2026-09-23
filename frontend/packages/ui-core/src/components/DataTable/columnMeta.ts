import type { RowData } from "@tanstack/react-table";

declare module "@tanstack/react-table" {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface ColumnMeta<TData extends RowData, TValue> {
    numeric?: boolean;
    mobileLabel?: string;
    hideOnMobile?: boolean;
    primary?: boolean;
    /** Internal: the row selection checkbox column. */
    selection?: boolean;
  }
}
