import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { DataTable } from "./DataTable";
import { fileColumns, sampleFiles, type FileItem } from "./storyData";
import { Button } from "../Button/Button";
import { TextBlock } from "../TextBlock/TextBlock";

const meta: Meta<typeof DataTable<FileItem>> = {
  title: "Core/DataTable",
  component: DataTable,
  parameters: { layout: "padded" },
};
export default meta;
type Story = StoryObj<typeof DataTable<FileItem>>;

export const RowDetails: Story = {
  render: function Render() {
    const [open, setOpen] = useState<string[]>([]);
    return (
      <DataTable<FileItem>
        caption="Files with inline details"
        data={sampleFiles.slice(0, 3)}
        columns={[
          {
            id: "name",
            header: "Name",
            accessorKey: "name",
            meta: { primary: true },
            enableSorting: false,
            cell: ({ row }) => (
              <Button
                variant="ghost"
                aria-expanded={open.includes(row.original.id)}
                onClick={() =>
                  setOpen((current) =>
                    current.includes(row.original.id)
                      ? current.filter((id) => id !== row.original.id)
                      : [...current, row.original.id],
                  )
                }
              >
                {row.original.name}
              </Button>
            ),
          },
          ...fileColumns.slice(1),
        ]}
        renderRowDetails={(row) =>
          open.includes(row.id) ? (
            <TextBlock label="File details" text={`Details of ${row.name}`} />
          ) : null
        }
      />
    );
  },
};
