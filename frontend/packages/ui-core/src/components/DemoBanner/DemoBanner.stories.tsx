import * as React from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { DemoBanner } from "./DemoBanner";

const meta: Meta<typeof DemoBanner> = {
  title: "Core/DemoBanner",
  component: DemoBanner,
  parameters: {
    layout: "fullscreen",
  },
};

export default meta;
type Story = StoryObj<typeof DemoBanner>;

export const Default: Story = {
  render: () => <DemoBanner />,
};

export const CustomText: Story = {
  render: () => (
    <DemoBanner>Simulated paper trading mode. No real orders are being submitted.</DemoBanner>
  ),
};
