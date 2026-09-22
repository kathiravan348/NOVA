import * as React from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { PnLText } from "./PnLText";

const meta: Meta<typeof PnLText> = {
  title: "Trading/PnLText",
  component: PnLText,
  parameters: {
    layout: "centered",
  },
};

export default meta;
type Story = StoryObj<typeof PnLText>;

export const Profit: Story = {
  render: () => <PnLText paise={9824400} />,
};

export const Loss: Story = {
  render: () => <PnLText paise={-1423600} />,
};

export const Zero: Story = {
  render: () => <PnLText paise={0} />,
};

export const WithPercent: Story = {
  render: () => <PnLText paise={9824400} percent={1.23} />,
};
