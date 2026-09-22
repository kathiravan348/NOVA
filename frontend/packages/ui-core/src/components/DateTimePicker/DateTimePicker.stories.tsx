import type { Meta, StoryObj } from "@storybook/react-vite";
import { DateTimePicker } from "./DateTimePicker";

const meta: Meta<typeof DateTimePicker> = {
  title: "Core/DateTimePicker",
  component: DateTimePicker,
  parameters: {
    layout: "padded",
  },
};

export default meta;
type Story = StoryObj<typeof DateTimePicker>;

export const Default: Story = {
  args: {
    label: "Backtest Start Time",
    defaultValue: "2026-09-21T06:30:00Z",
  },
};

export const DateMode: Story = {
  args: {
    label: "Settlement Date",
    mode: "date",
    defaultValue: "2026-09-21",
  },
};

export const WithDescription: Story = {
  args: {
    label: "Simulation Window End",
    description: "Time in IST; converted to UTC on save",
    defaultValue: "2026-09-21T10:00:00Z",
  },
};

export const Error: Story = {
  args: {
    label: "Scheduled Run Time",
    error: "Start time must be before end time",
    defaultValue: "2026-09-21T03:45:00Z",
  },
};

export const Disabled: Story = {
  args: {
    label: "Market Open Time",
    defaultValue: "2026-09-21T03:45:00Z",
    disabled: true,
  },
};
