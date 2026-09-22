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
    label: "Active users",
    value: "1,284",
    caption: "+12.4% vs last week",
    captionTone: "positive",
    className: "max-w-xs",
  },
};

export const Tones: Story = {
  render: () => (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-2xl">
      <StatCard
        label="Active users"
        value="1,284"
        caption="+12.4% vs last week"
        captionTone="positive"
      />
      <StatCard label="Error rate" value="4.2%" caption="Above threshold" captionTone="negative" />
      <StatCard label="Jobs run" value="1,420" caption="Across 3 queues" captionTone="neutral" />
    </div>
  ),
};

export const Loading: Story = {
  render: () => (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-2xl">
      <StatCard label="Active users" value="1,284" caption="+12.4% vs last week" loading />
      <StatCard label="Error rate" value="4.2%" caption="Above threshold" loading />
      <StatCard label="Jobs run" value="1,420" caption="Across 3 queues" loading />
    </div>
  ),
};
