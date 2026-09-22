import type { Meta, StoryObj } from "@storybook/react-vite";
import { StatCard } from "./StatCard";

const meta: Meta<typeof StatCard> = {
  title: "Core/StatCard",
  component: StatCard,
  parameters: {
    layout: "padded",
  },
};

export default meta;
type Story = StoryObj<typeof StatCard>;

export const Default: Story = {
  args: {
    label: "Net Profit",
    value: "+₹98,244",
    caption: "+12.4% vs benchmark",
    captionTone: "positive",
    className: "max-w-xs",
  },
};

export const Tones: Story = {
  render: () => (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-2xl">
      <StatCard
        label="Net P&L"
        value="+₹98,244"
        caption="+12.4% vs benchmark"
        captionTone="positive"
      />
      <StatCard
        label="Max Drawdown"
        value="-14.2%"
        caption="Breached threshold"
        captionTone="negative"
      />
      <StatCard
        label="Total Trades"
        value="1,420"
        caption="Across 3 strategies"
        captionTone="neutral"
      />
    </div>
  ),
};

export const Loading: Story = {
  render: () => (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-2xl">
      <StatCard label="Net P&L" value="+₹98,244" caption="+12.4% vs benchmark" loading />
      <StatCard label="Max Drawdown" value="-14.2%" caption="Breached threshold" loading />
      <StatCard label="Total Trades" value="1,420" caption="Across 3 strategies" loading />
    </div>
  ),
};
