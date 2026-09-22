import * as React from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { Tabs } from "./Tabs";

const meta: Meta<typeof Tabs> = {
  title: "Core/Tabs",
  component: Tabs,
  parameters: {
    layout: "padded",
  },
};

export default meta;
type Story = StoryObj<typeof Tabs>;

export const Default: Story = {
  render: () => (
    <Tabs
      ariaLabel="Account management tabs"
      items={[
        {
          value: "overview",
          label: "Overview",
          content: <p className="text-body text-text-secondary">Overview content panel</p>,
        },
        {
          value: "orders",
          label: "Orders",
          content: <p className="text-body text-text-secondary">Orders history panel</p>,
        },
        {
          value: "positions",
          label: "Positions",
          content: <p className="text-body text-text-secondary">Open positions panel</p>,
        },
      ]}
    />
  ),
};

export const WithDisabled: Story = {
  render: () => (
    <Tabs
      ariaLabel="Strategy tabs with disabled"
      items={[
        {
          value: "rules",
          label: "Rule Builder",
          content: <p className="text-body text-text-secondary">Visual rule editor</p>,
        },
        {
          value: "code",
          label: "Python Code",
          content: <p className="text-body text-text-secondary">CodeMirror editor</p>,
        },
        {
          value: "deploy",
          label: "Live Deployment",
          content: <p className="text-body text-text-secondary">Deployment settings</p>,
          disabled: true,
        },
      ]}
    />
  ),
};

export const Many: Story = {
  render: () => (
    <Tabs
      ariaLabel="Many horizontal scrollable tabs"
      items={[
        { value: "tab-1", label: "Dashboard", content: <p className="text-body">Tab 1</p> },
        { value: "tab-2", label: "Backtest Results", content: <p className="text-body">Tab 2</p> },
        { value: "tab-3", label: "Trade Log", content: <p className="text-body">Tab 3</p> },
        { value: "tab-4", label: "Charges Breakdown", content: <p className="text-body">Tab 4</p> },
        { value: "tab-5", label: "Drawdown Analysis", content: <p className="text-body">Tab 5</p> },
        {
          value: "tab-6",
          label: "Broker Rate Limits",
          content: <p className="text-body">Tab 6</p>,
        },
        { value: "tab-7", label: "Audit Trails", content: <p className="text-body">Tab 7</p> },
        { value: "tab-8", label: "System Config", content: <p className="text-body">Tab 8</p> },
      ]}
    />
  ),
};
