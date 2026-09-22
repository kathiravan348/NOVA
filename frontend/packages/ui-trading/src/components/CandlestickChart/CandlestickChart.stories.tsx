import * as React from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { CandlestickChart } from "./CandlestickChart";
import { dailyCandles, dailyCandlesNoVolume, intradayCandles } from "./storyData";

const meta: Meta<typeof CandlestickChart> = {
  title: "Trading/CandlestickChart",
  component: CandlestickChart,
  parameters: {
    layout: "padded",
  },
};

export default meta;
type Story = StoryObj<typeof CandlestickChart>;

export const Daily: Story = {
  render: () => (
    <CandlestickChart candles={dailyCandles} timeframe="1d" ariaLabel="RELIANCE daily candles" />
  ),
};

export const Intraday5m: Story = {
  render: () => (
    <CandlestickChart
      candles={intradayCandles}
      timeframe="5m"
      ariaLabel="RELIANCE 5-minute candles"
    />
  ),
};

export const NoVolume: Story = {
  render: () => (
    <CandlestickChart
      candles={dailyCandlesNoVolume}
      timeframe="1d"
      ariaLabel="RELIANCE daily candles"
    />
  ),
};

export const Loading: Story = {
  render: () => <CandlestickChart candles={[]} timeframe="1d" loading ariaLabel="Candles" />,
};

export const Empty: Story = {
  render: () => <CandlestickChart candles={[]} timeframe="1d" ariaLabel="Candles" />,
};

export const Narrow: Story = {
  globals: { viewport: { value: "mobile", isRotated: false } },
  render: () => (
    <CandlestickChart candles={dailyCandles} timeframe="1d" ariaLabel="RELIANCE daily candles" />
  ),
};
