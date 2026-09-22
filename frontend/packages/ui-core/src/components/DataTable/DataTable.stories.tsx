import * as React from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { DataTable } from "./DataTable";
import { fileColumns, sampleFiles, type FileItem } from "./storyData";

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
