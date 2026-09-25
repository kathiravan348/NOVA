import type { Meta, StoryObj } from "@storybook/react-vite";
import { Select } from "./Select";

const sampleOptions = [
  { value: "nifty50", label: "NIFTY 50" },
  { value: "niftybank", label: "NIFTY Bank" },
  { value: "niftyit", label: "NIFTY IT" },
  { value: "midcap50", label: "NIFTY Midcap 50", disabled: true },
];

const meta: Meta<typeof Select> = {
  title: "Core/Select",
  component: Select,
  parameters: {
    layout: "padded",
  },
};

export default meta;
type Story = StoryObj<typeof Select>;

export const Default: Story = {
  args: {
    label: "Index Universe",
    options: sampleOptions,
    defaultValue: "nifty50",
  },
};

export const Placeholder: Story = {
  args: {
    label: "Index Universe",
    placeholder: "Select an index universe",
    options: sampleOptions,
  },
};

export const WithDescription: Story = {
  args: {
    label: "Execution Mode",
    description: "Paper trading simulates execution without real orders",
    options: [
      { value: "paper", label: "Paper Trading" },
      { value: "live", label: "Live Trading" },
    ],
    defaultValue: "paper",
  },
};

export const Error: Story = {
  args: {
    label: "Account",
    placeholder: "Choose broker account",
    options: sampleOptions,
    error: "Account selection is required",
  },
};

export const Disabled: Story = {
  args: {
    label: "Settlement Cycle",
    options: [{ value: "t1", label: "T+1 Settlement" }],
    defaultValue: "t1",
    disabled: true,
  },
};

export const Grouped: Story = {
  args: {
    label: "Indicator",
    options: [
      { value: "sma", label: "SMA", group: "Trend" },
      { value: "ema", label: "EMA", group: "Trend" },
      { value: "macd", label: "MACD line", group: "Trend" },
      { value: "rsi", label: "RSI", group: "Momentum" },
      { value: "atr", label: "ATR", group: "Volatility" },
      { value: "pivot", label: "Pivot", group: "Levels" },
    ],
    defaultValue: "rsi",
  },
};
