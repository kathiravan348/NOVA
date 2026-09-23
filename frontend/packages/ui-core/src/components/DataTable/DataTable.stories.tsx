import * as React from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { DataTable } from "./DataTable";
import { Select } from "../Select/Select";
import { fileColumns, fileSearchText, sampleFiles, type FileItem } from "./storyData";

const meta: Meta<typeof DataTable<FileItem>> = {
  title: "Core/DataTable",
  component: DataTable,
  parameters: {
    layout: "padded",
  },
};

export default meta;
type Story = StoryObj<typeof DataTable<FileItem>>;

export const Default: Story = {
  render: () => (
    <DataTable<FileItem>
      caption="Project documents and attachments"
      columns={fileColumns}
      data={sampleFiles}
      pageSize={10}
    />
  ),
};

export const Sorted: Story = {
  render: () => (
    <DataTable<FileItem>
      caption="Project documents sorted by size"
      columns={fileColumns}
      data={sampleFiles}
      pageSize={10}
      initialSort={[{ id: "sizeKb", desc: true }]}
    />
  ),
};

export const Loading: Story = {
  render: () => (
    <DataTable<FileItem>
      caption="Loading project files"
      columns={fileColumns}
      data={[]}
      loading={true}
    />
  ),
};

export const Empty: Story = {
  render: () => (
    <DataTable<FileItem>
      caption="Empty files list"
      columns={fileColumns}
      data={[]}
      emptyState="No documents have been uploaded yet."
    />
  ),
};

export const Error: Story = {
  render: () => (
    <DataTable<FileItem>
      caption="Files error state"
      columns={fileColumns}
      data={[]}
      error="Failed to load files from storage service. Please check your network connection."
    />
  ),
};

export const FewRows: Story = {
  render: () => (
    <DataTable<FileItem>
      caption="Recent files"
      columns={fileColumns}
      data={sampleFiles.slice(0, 4)}
      pageSize={10}
    />
  ),
};

function SelectableTable(props: {
  withSearch?: boolean;
  unselectable?: boolean;
  initial?: string[];
  query?: string;
}): React.ReactElement {
  const [selected, setSelected] = React.useState<string[]>(props.initial ?? []);
  const [type, setType] = React.useState("All");
  const rows = type === "All" ? sampleFiles : sampleFiles.filter((f) => f.type === type);
  return (
    <DataTable<FileItem>
      caption="Selectable files"
      columns={fileColumns}
      data={rows}
      getRowId={(row) => row.id}
      selectedIds={selected}
      onSelectedIdsChange={setSelected}
      isRowSelectable={props.unselectable ? (row) => row.type !== "PDF" : undefined}
      search={
        props.withSearch
          ? { label: "Search files", placeholder: "Name or owner", getText: fileSearchText }
          : undefined
      }
      toolbar={
        props.withSearch ? (
          <Select
            label="Type"
            value={type}
            onChange={(e) => setType(e.target.value)}
            options={["All", "PDF", "PNG", "JSON", "DOCX", "SVG"].map((t) => ({
              value: t,
              label: t,
            }))}
            containerClassName="md:w-40"
          />
        ) : undefined
      }
    />
  );
}

export const Selectable: Story = {
  render: () => <SelectableTable initial={["file-2"]} />,
};

export const SelectableWithSearch: Story = {
  render: () => <SelectableTable withSearch />,
};

export const SomeRowsUnselectable: Story = {
  render: () => <SelectableTable unselectable />,
};

export const EmptySearchResult: Story = {
  render: () => <SelectableTable withSearch />,
  play: async ({ canvasElement }) => {
    const input = canvasElement.querySelector<HTMLInputElement>('input[type="search"]');
    if (!input) return;
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    setter?.call(input, "zzz");
    input.dispatchEvent(new Event("input", { bubbles: true }));
  },
};
