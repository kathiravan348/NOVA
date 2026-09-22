import * as React from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { Meter } from "./Meter";

const meta: Meta<typeof Meter> = {
  title: "Trading/Meter",
  component: Meter,
  parameters: {
    layout: "centered",
  },
};

export default meta;
type Story = StoryObj<typeof Meter>;

export const Normal: Story = {
  render: () => (
    <div className="w-72">
      <Meter label="Orders Rate Limit" value={5} max={10} valueText="5 / 10 per sec" />
    </div>
  ),
};

export const Warning: Story = {
  render: () => (
    <div className="w-72">
      <Meter label="Orders Rate Limit" value={8.5} max={10} valueText="8.5 / 10 per sec" />
    </div>
  ),
};

export const Danger: Story = {
  render: () => (
    <div className="w-72">
      <Meter label="Orders Rate Limit" value={9.8} max={10} valueText="9.8 / 10 per sec" />
    </div>
  ),
};

export const Full: Story = {
  render: () => (
    <div className="w-72">
      <Meter label="Data Quota" value={10} max={10} valueText="10 / 10 GB" />
    </div>
  ),
};
