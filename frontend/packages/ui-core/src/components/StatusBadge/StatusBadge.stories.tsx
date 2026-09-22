import type { Meta, StoryObj } from "@storybook/react-vite";
import { StatusBadge } from "./StatusBadge";

const meta: Meta<typeof StatusBadge> = {
  title: "Core/StatusBadge",
  component: StatusBadge,
  parameters: {
    layout: "padded",
  },
};

export default meta;
type Story = StoryObj<typeof StatusBadge>;

export const Default: Story = {
  args: {
    label: "Connected",
    tone: "success",
  },
};

export const Tones: Story = {
  render: () => (
    <div className="flex flex-wrap gap-3 max-w-full items-center">
      <StatusBadge tone="neutral" label="Draft" />
      <StatusBadge tone="info" label="Running" />
      <StatusBadge tone="success" label="Connected" />
      <StatusBadge tone="warning" label="Pending" />
      <StatusBadge tone="danger" label="Failed" />
    </div>
  ),
};
