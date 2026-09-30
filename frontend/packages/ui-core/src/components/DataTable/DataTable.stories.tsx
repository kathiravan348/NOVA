import * as React from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { DataTable } from "./DataTable";
import { Select } from "../Select/Select";
import {
  fileColumns,
  fileSearchText,
  fruitColumns,
  fruitSearchText,
  sampleFiles,
  sampleFruits,
  type FileItem,
  type Fruit,
} from "./storyData";
import type { DataTableGroups } from "./DataTableGroups";
import { Button } from "../Button/Button";
import { Modal } from "../Modal/Modal";
import { TextBlock } from "../TextBlock/TextBlock";

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

export const WithoutPagination: Story = {
  render: () => <DataTable caption="All files" columns={fileColumns} data={sampleFiles} />,
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

function CompactBatchTable(): React.ReactElement {
  const [selected, setSelected] = React.useState<string[]>([]);
  const [details, setDetails] = React.useState<FileItem | null>(null);
  const data = React.useMemo(
    () =>
      Array.from({ length: 50 }, (_, index) => ({
        ...sampleFiles[index % sampleFiles.length]!,
        id: `request-${index}`,
        name: `Document export ${index + 1}`,
      })),
    [],
  );
  return (
    <>
      <DataTable<FileItem>
        caption="Compact requests"
        data={data}
        columns={[
          { accessorKey: "name", header: "Request", meta: { primary: true } },
          { accessorKey: "owner", header: "Requested by" },
          {
            id: "details",
            header: "Details",
            cell: ({ row }) => (
              <Button size="sm" variant="secondary" onClick={() => setDetails(row.original)}>
                View details
              </Button>
            ),
          },
        ]}
        getRowId={(row) => row.id}
        selectedIds={selected}
        onSelectedIdsChange={setSelected}
        search={{ label: "Search requests", getText: fileSearchText }}
        toolbar={
          <Button size="sm" disabled={selected.length === 0}>
            Approve selected ({selected.length})
          </Button>
        }
      />
      <Modal
        open={details !== null}
        onOpenChange={(open) => {
          if (!open) setDetails(null);
        }}
        title="Request details"
      >
        <TextBlock label="Request body" text={JSON.stringify(details, null, 2)} />
      </Modal>
    </>
  );
}

export const CompactBatchRequests: Story = { render: () => <CompactBatchTable /> };

const byColour = (defaultOpen = false): DataTableGroups<Fruit> => ({
  of: (fruit) => fruit.colours,
  summary: (_, rows) =>
    `${rows.length} ${rows.length === 1 ? "fruit" : "fruits"} · ${rows.reduce((n, f) => n + f.stock, 0)} in stock`,
  actions: (colour) => (
    <Button size="sm" variant="secondary">
      Order {colour.toLowerCase()}
    </Button>
  ),
  defaultOpen,
});

/** Rows in collapsible groups (D63); Apple is both red and green. */
export const Grouped: Story = {
  render: () => (
    <DataTable<Fruit>
      caption="Fruit by colour"
      columns={fruitColumns}
      data={sampleFruits}
      groups={byColour()}
    />
  ),
};

export const GroupedOpen: Story = {
  render: () => (
    <DataTable<Fruit>
      caption="Fruit by colour, open"
      columns={fruitColumns}
      data={sampleFruits}
      groups={byColour(true)}
      initialSort={[{ id: "stock", desc: true }]}
    />
  ),
};

export const GroupedWithSearch: Story = {
  render: () => (
    <DataTable<Fruit>
      caption="Fruit by colour with search"
      columns={fruitColumns}
      data={sampleFruits}
      groups={byColour(true)}
      search={{ label: "Search fruit", getText: fruitSearchText }}
    />
  ),
};

export const GroupedLoading: Story = {
  render: () => (
    <DataTable<Fruit>
      caption="Fruit by colour, loading"
      columns={fruitColumns}
      data={[]}
      groups={byColour()}
      loading
    />
  ),
};

export const GroupedEmpty: Story = {
  render: () => (
    <DataTable<Fruit>
      caption="Fruit by colour, empty"
      columns={fruitColumns}
      data={[]}
      groups={byColour()}
      emptyState="No fruit yet"
    />
  ),
};
