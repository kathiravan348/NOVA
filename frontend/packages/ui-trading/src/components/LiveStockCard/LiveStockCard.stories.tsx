import type { Meta, StoryObj } from "@storybook/react-vite";
import { LiveStockCard } from "./LiveStockCard";

const meta: Meta<typeof LiveStockCard> = {
  title: "Trading/LiveStockCard",
  component: LiveStockCard,
  parameters: { layout: "padded" },
  args: {
    symbol: "RELIANCE",
    name: "Reliance Industries",
    price: 298450,
    changePercent: 1.2,
    lastTick: "13:30:00",
    secondsWithTick: 14900,
    secondsExpected: 15301,
  },
};

export default meta;
type Story = StoryObj<typeof LiveStockCard>;

export const Default: Story = {};
export const Falling: Story = { args: { changePercent: -0.4 } };
export const NoRecentTick: Story = { args: { stale: true, lastTick: "13:29:41" } };
/** Loading / empty: before the first tick nothing is known. */
export const NoTickYet: Story = {
  args: { price: null, changePercent: null, lastTick: null, secondsWithTick: 0, stale: true },
};
