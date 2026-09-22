import type { ColumnDef } from "@tanstack/react-table";
import "./columnMeta";

export interface FileItem {
  id: string;
  name: string;
  owner: string;
  type: string;
  sizeKb: number;
  updated: string;
}

export const sampleFiles: FileItem[] = Array.from({ length: 25 }, (_, i) => {
  const index = i + 1;
  const types = ["PDF", "PNG", "JSON", "DOCX", "SVG"];
  const owners = ["Aarav", "Priya", "Rohan", "Ananya", "Vikram"];
  const type = types[i % types.length] ?? "PDF";
  const owner = owners[i % owners.length] ?? "Aarav";

  return {
    id: `file-${index}`,
    name: `document_report_q${(i % 4) + 1}_v${index}.${type.toLowerCase()}`,
    owner,
    type,
    sizeKb: 120 + i * 45,
    updated: `2026-03-${String((i % 28) + 1).padStart(2, "0")}`,
  };
});

export const fileColumns: ColumnDef<FileItem>[] = [
  {
    accessorKey: "name",
    header: "Name",
    meta: {
      primary: true,
      mobileLabel: "File Name",
    },
  },
  {
    accessorKey: "owner",
    header: "Owner",
    meta: {
      mobileLabel: "Owner",
    },
  },
  {
    accessorKey: "type",
    header: "Type",
    meta: {
      mobileLabel: "File Type",
    },
  },
  {
    accessorKey: "sizeKb",
    header: "Size (KB)",
    meta: {
      numeric: true,
      mobileLabel: "Size",
    },
  },
  {
    accessorKey: "updated",
    header: "Updated",
    meta: {
      mobileLabel: "Last Updated",
    },
  },
];
