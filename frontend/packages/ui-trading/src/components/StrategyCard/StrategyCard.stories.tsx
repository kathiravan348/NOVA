import * as React from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import type { StrategyStats } from "@nova/contracts";
import { StatusBadge } from "@nova/ui-core";
import { StrategyCard } from "./StrategyCard";

const meta: Meta<typeof StrategyCard> = {
  title: "Trading/StrategyCard",
  component: StrategyCard,
  parameters: { layout: "padded" },
};

export default meta;
type Story = StoryObj<typeof StrategyCard>;

const withResults: StrategyStats = {
  strategyId: "s1",
  runsTotal: 12,
  runsCompleted: 9,
  runsFailed: 1,
  runsInProgress: 2,
  lastRunAt: "2026-09-21T06:20:00Z",
  bestReturnPercent: 8.4,
  worstReturnPercent: -2.15,
  winRateMinPercent: 48,
  winRateMaxPercent: 71.5,
  worstDrawdownPercent: -6.2,
  bestNetPnl: { runId: "r1", netPnlPaise: 8_412_550 },
};

const noResults: StrategyStats = {
  ...withResults,
  runsTotal: 1,
  runsCompleted: 0,
  runsFailed: 0,
  runsInProgress: 1,
  bestReturnPercent: null,
  worstReturnPercent: null,
  winRateMinPercent: null,
  winRateMaxPercent: null,
  worstDrawdownPercent: null,
  bestNetPnl: null,
};

const base = {
  title: "VWAP Momentum Intraday",
  status: <StatusBadge tone="success" label="Active" />,
  details: ["Visual", "Equity intraday", "5 min", "v2"],
  updatedLabel: "Updated 15 Aug 2026",
  lastRunLabel: "21 Sep 2026",
};

const Frame = ({ children }: { children: React.ReactNode }) => (
  <div className="max-w-md">{children}</div>
);

export const Default: Story = {
  render: () => (
    <Frame>
      <StrategyCard {...base} stats={withResults} />
    </Frame>
  ),
};

export const NoCompletedRuns: Story = {
  render: () => (
    <Frame>
      <StrategyCard
        {...base}
        title="Delivery Mean Reversion"
        status={<StatusBadge tone="neutral" label="Draft" />}
        stats={noResults}
      />
    </Frame>
  ),
};

export const Loading: Story = {
  render: () => (
    <Frame>
      <StrategyCard {...base} statsLoading />
    </Frame>
  ),
};

export const StatsUnavailable: Story = {
  render: () => (
    <Frame>
      <StrategyCard {...base} />
    </Frame>
  ),
};
