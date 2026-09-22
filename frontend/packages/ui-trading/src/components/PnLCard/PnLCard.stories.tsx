import * as React from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { PnLCard } from "./PnLCard";

const meta: Meta<typeof PnLCard> = {
  title: "Trading/PnLCard",
  component: PnLCard,
  parameters: {
    layout: "centered",
  },
};

export default meta;
type Story = StoryObj<typeof PnLCard>;

export const Profit: Story = {
  render: () => (
    <div className="w-64">
      <PnLCard
        label="Net Realised P&L"
        paise={9824400}
        percent={2.45}
        caption="Today's closed positions"
        captionTone="positive"
      />
    </div>
  ),
};

export const Loss: Story = {
  render: () => (
    <div className="w-64">
      <PnLCard
        label="Unrealised P&L"
        paise={-1423600}
        percent={-0.35}
        caption="12 open positions"
        captionTone="negative"
      />
    </div>
  ),
};

export const Loading: Story = {
  render: () => (
    <div className="w-64">
      <PnLCard label="Total P&L" paise={0} loading={true} />
    </div>
  ),
};
