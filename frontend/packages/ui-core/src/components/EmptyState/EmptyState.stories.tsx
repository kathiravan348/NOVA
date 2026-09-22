import * as React from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { AlertCircle, FolderOpen, Plus } from "lucide-react";
import { Button } from "../Button/Button";
import { EmptyState } from "./EmptyState";

const meta: Meta<typeof EmptyState> = {
  title: "Core/EmptyState",
  component: EmptyState,
  parameters: {
    layout: "padded",
  },
};

export default meta;
type Story = StoryObj<typeof EmptyState>;

export const Default: Story = {
  render: () => (
    <EmptyState
      icon={<FolderOpen className="h-8 w-8" />}
      title="No strategies found"
      description="You have not created any automated trading strategies yet."
    />
  ),
};

export const WithAction: Story = {
  render: () => (
    <EmptyState
      icon={<FolderOpen className="h-8 w-8" />}
      title="No backtests yet"
      description="Run a historical backtest to evaluate your strategy performance."
      action={
        <Button variant="primary" size="md">
          <Plus className="h-4 w-4 mr-2" />
          Create New Strategy
        </Button>
      }
    />
  ),
};

export const Error: Story = {
  render: () => (
    <EmptyState
      icon={<AlertCircle className="h-8 w-8" />}
      tone="error"
      title="Failed to load data"
      description="Unable to reach the broker server. Please verify your connection."
      action={
        <Button variant="secondary" size="md">
          Retry
        </Button>
      }
    />
  ),
};
