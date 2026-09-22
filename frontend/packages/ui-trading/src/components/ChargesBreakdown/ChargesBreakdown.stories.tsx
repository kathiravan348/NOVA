import * as React from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { ChargesBreakdown } from "./ChargesBreakdown";
import { deliveryCharges, intradayCharges } from "./storyData";

const meta: Meta<typeof ChargesBreakdown> = {
  title: "Trading/ChargesBreakdown",
  component: ChargesBreakdown,
  parameters: {
    layout: "centered",
  },
};

export default meta;
type Story = StoryObj<typeof ChargesBreakdown>;

export const DeliveryWithDP: Story = {
  render: () => (
    <div className="w-80">
      <ChargesBreakdown charges={deliveryCharges} />
    </div>
  ),
};

export const IntradayHideZero: Story = {
  render: () => (
    <div className="w-80">
      <ChargesBreakdown charges={intradayCharges} hideZero />
    </div>
  ),
};

export const Loading: Story = {
  render: () => (
    <div className="w-80">
      <ChargesBreakdown charges={deliveryCharges} loading />
    </div>
  ),
};
