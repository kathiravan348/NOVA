import * as React from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { DescriptionList } from "./DescriptionList";

const items = [
  { label: "Segment", value: "Equity intraday" },
  { label: "Timeframe", value: "5 minutes" },
  { label: "Universe", value: "RELIANCE, TCS, INFY" },
  { label: "Quantity", value: "50", numeric: true },
  { label: "Capital", value: "₹5,00,000", numeric: true },
  { label: "Risk", value: "Stop-loss 1.5% · Target 3%" },
];

const meta: Meta<typeof DescriptionList> = {
  title: "Core/DescriptionList",
  component: DescriptionList,
  parameters: { layout: "padded" },
  args: { items },
};

export default meta;
type Story = StoryObj<typeof DescriptionList>;

export const Default: Story = {
  render: (args) => (
    <div className="max-w-md">
      <DescriptionList {...args} />
    </div>
  ),
};

export const TwoColumns: Story = {
  args: { columns: 2 },
};

export const Narrow: Story = {
  globals: { viewport: { value: "mobile", isRotated: false } },
  args: { columns: 2 },
};
