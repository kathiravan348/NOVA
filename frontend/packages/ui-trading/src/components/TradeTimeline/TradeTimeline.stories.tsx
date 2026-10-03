import type { Meta, StoryObj } from "@storybook/react-vite";
import { TradeTimeline } from "./TradeTimeline";
import { reasonLabels, timelineEvents } from "./TradeTimeline.fixtures";

const meta: Meta<typeof TradeTimeline> = {
  title: "Trading/TradeTimeline",
  component: TradeTimeline,
  parameters: { layout: "padded" },
  args: { events: timelineEvents, clock: "minutes", reasonLabels },
};

export default meta;
type Story = StoryObj<typeof TradeTimeline>;

/** Buy (blue), profit sell (green), stop-loss sell (red + chip), zero sell (grey). */
export const Mixed: Story = {};

/** Seconds strategies and recorded runs show HH:mm:ss. */
export const Seconds: Story = { args: { clock: "seconds" } };

/** Daily strategies show the date only. */
export const Daily: Story = { args: { clock: "none" } };

export const Loading: Story = { args: { events: [], loading: true } };

export const Empty: Story = { args: { events: [], emptyState: "No trades for these filters" } };
