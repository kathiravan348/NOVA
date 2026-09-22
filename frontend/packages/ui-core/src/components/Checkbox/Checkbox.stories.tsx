import type { Meta, StoryObj } from "@storybook/react-vite";
import { Checkbox } from "./Checkbox";

const meta: Meta<typeof Checkbox> = {
  title: "Core/Checkbox",
  component: Checkbox,
  parameters: {
    layout: "padded",
  },
};

export default meta;
type Story = StoryObj<typeof Checkbox>;

export const Default: Story = {
  args: {
    label: "Enable SL-M (Stop-Loss Market) protection",
    defaultChecked: true,
  },
};

export const WithDescription: Story = {
  args: {
    label: "Rebalance portfolio daily",
    description: "Executes weight rebalancing at 15:15 IST each trading session",
    defaultChecked: false,
  },
};

export const Error: Story = {
  args: {
    label: "I accept the algo trading terms & risk disclosure",
    error: "You must accept the terms before running backtest",
    defaultChecked: false,
  },
};

export const Disabled: Story = {
  args: {
    label: "Direct DMA market access",
    description: "Requires institutional membership",
    disabled: true,
    defaultChecked: false,
  },
};
