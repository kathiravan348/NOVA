import type { Meta, StoryObj } from "@storybook/react-vite";
import { Switch } from "./Switch";

const meta: Meta<typeof Switch> = {
  title: "Core/Switch",
  component: Switch,
  parameters: {
    layout: "padded",
  },
};

export default meta;
type Story = StoryObj<typeof Switch>;

export const Default: Story = {
  args: {
    label: "Auto-square off at 15:20 IST",
    defaultChecked: true,
  },
};

export const WithDescription: Story = {
  args: {
    label: "Live Relay WebSocket Feed",
    description: "Stream tick-by-tick market depth from broker session",
    defaultChecked: false,
  },
};

export const Error: Story = {
  args: {
    label: "Authorize order routing",
    error: "Authorization is required to proceed",
    defaultChecked: false,
  },
};

export const Disabled: Story = {
  args: {
    label: "Direct Market Access",
    description: "Locked by regulatory risk policy",
    disabled: true,
    defaultChecked: false,
  },
};
