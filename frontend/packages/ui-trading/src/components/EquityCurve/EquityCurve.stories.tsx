import * as React from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { EquityCurve } from "./EquityCurve";
import { INITIAL_CAPITAL_PAISE, equityOnly, equityWithBenchmark } from "./storyData";

const meta: Meta<typeof EquityCurve> = {
  title: "Trading/EquityCurve",
  component: EquityCurve,
  parameters: {
    layout: "padded",
  },
};

export default meta;
type Story = StoryObj<typeof EquityCurve>;

export const Default: Story = {
  render: () => (
    <EquityCurve
      points={equityWithBenchmark}
      initialCapitalPaise={INITIAL_CAPITAL_PAISE}
      ariaLabel="Equity curve versus NIFTY 50"
    />
  ),
};

export const WithoutBenchmark: Story = {
  render: () => (
    <EquityCurve
      points={equityOnly}
      initialCapitalPaise={INITIAL_CAPITAL_PAISE}
      ariaLabel="Equity curve"
    />
  ),
};

export const Loading: Story = {
  render: () => <EquityCurve points={[]} loading ariaLabel="Equity curve" />,
};

export const Empty: Story = {
  render: () => <EquityCurve points={[]} ariaLabel="Equity curve" />,
};

export const Narrow: Story = {
  globals: { viewport: { value: "mobile", isRotated: false } },
  render: () => (
    <EquityCurve
      points={equityWithBenchmark}
      initialCapitalPaise={INITIAL_CAPITAL_PAISE}
      ariaLabel="Equity curve versus NIFTY 50"
    />
  ),
};
