import type { Meta, StoryObj } from "@storybook/react-vite";
import { Input } from "./Input";

const meta: Meta<typeof Input> = {
  title: "Core/Input",
  component: Input,
  parameters: {
    layout: "padded",
  },
};

export default meta;
type Story = StoryObj<typeof Input>;

export const Default: Story = {
  args: {
    label: "Strategy Name",
    placeholder: "e.g. NIFTY Momentum Alpha",
  },
};

export const WithDescription: Story = {
  args: {
    label: "API Secret Key",
    description: "Your 32-character secret key from broker portal",
    placeholder: "Enter secret key",
  },
};

export const Error: Story = {
  args: {
    label: "Email Address",
    defaultValue: "invalid-email",
    error: "Please enter a valid email address",
  },
};

export const Disabled: Story = {
  args: {
    label: "Account ID",
    defaultValue: "ACC-992144",
    disabled: true,
  },
};

export const Numeric: Story = {
  args: {
    label: "Capital Allocation (Paise)",
    numeric: true,
    defaultValue: "50000000",
  },
};

export const WithAdornments: Story = {
  args: {
    label: "Stop Loss Percentage",
    leading: "₹",
    trailing: "%",
    defaultValue: "2.5",
  },
};
