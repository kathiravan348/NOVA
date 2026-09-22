import * as React from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { PriceText } from "./PriceText";

const meta: Meta<typeof PriceText> = {
  title: "Trading/PriceText",
  component: PriceText,
  parameters: {
    layout: "centered",
  },
};

export default meta;
type Story = StoryObj<typeof PriceText>;

export const Default: Story = {
  render: () => <PriceText paise={161890} />,
};

export const WithCurrency: Story = {
  render: () => <PriceText paise={161890} currency />,
};
