import type { Meta, StoryObj } from "@storybook/react-vite";
import { Plus, Search, Settings, Trash2 } from "lucide-react";
import { IconButton } from "./IconButton";

const meta: Meta<typeof IconButton> = {
  title: "Core/IconButton",
  component: IconButton,
  parameters: {
    layout: "padded",
  },
};

export default meta;
type Story = StoryObj<typeof IconButton>;

export const Default: Story = {
  args: {
    "aria-label": "Add item",
    icon: <Plus className="h-4 w-4" />,
    variant: "primary",
    size: "md",
  },
};

export const Variants: Story = {
  render: () => (
    <div className="flex flex-wrap gap-3 max-w-full items-center">
      <IconButton aria-label="Add item" icon={<Plus className="h-4 w-4" />} variant="primary" />
      <IconButton aria-label="Search" icon={<Search className="h-4 w-4" />} variant="secondary" />
      <IconButton aria-label="Settings" icon={<Settings className="h-4 w-4" />} variant="ghost" />
      <IconButton aria-label="Delete" icon={<Trash2 className="h-4 w-4" />} variant="danger" />
    </div>
  ),
};

export const Sizes: Story = {
  render: () => (
    <div className="flex flex-wrap gap-3 max-w-full items-center">
      <IconButton aria-label="Add small" icon={<Plus className="h-3.5 w-3.5" />} size="sm" />
      <IconButton aria-label="Add medium" icon={<Plus className="h-4 w-4" />} size="md" />
      <IconButton aria-label="Add large" icon={<Plus className="h-5 w-5" />} size="lg" />
    </div>
  ),
};

export const Loading: Story = {
  render: () => (
    <div className="flex flex-wrap gap-3 max-w-full items-center">
      <IconButton
        aria-label="Saving"
        icon={<Plus className="h-4 w-4" />}
        variant="primary"
        loading
      />
      <IconButton
        aria-label="Loading search"
        icon={<Search className="h-4 w-4" />}
        variant="secondary"
        loading
      />
      <IconButton
        aria-label="Deleting"
        icon={<Trash2 className="h-4 w-4" />}
        variant="danger"
        loading
      />
    </div>
  ),
};

export const Disabled: Story = {
  render: () => (
    <div className="flex flex-wrap gap-3 max-w-full items-center">
      <IconButton
        aria-label="Add item"
        icon={<Plus className="h-4 w-4" />}
        variant="primary"
        disabled
      />
      <IconButton
        aria-label="Search"
        icon={<Search className="h-4 w-4" />}
        variant="secondary"
        disabled
      />
      <IconButton
        aria-label="Settings"
        icon={<Settings className="h-4 w-4" />}
        variant="ghost"
        disabled
      />
      <IconButton
        aria-label="Delete"
        icon={<Trash2 className="h-4 w-4" />}
        variant="danger"
        disabled
      />
    </div>
  ),
};
