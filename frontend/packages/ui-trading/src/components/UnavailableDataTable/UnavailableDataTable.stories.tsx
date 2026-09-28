import type { Meta, StoryObj } from "@storybook/react-vite";
import type { UnavailableDay } from "@nova/contracts";
import { UnavailableDataTable } from "./UnavailableDataTable";

const row: UnavailableDay = {
  id: "gap_awl",
  exchange: "NSE",
  symbol: "AWL",
  timeframe: "1d",
  day: "2022-05-05",
  broker: "Zerodha",
  reason: "no_usable_candle",
  firstCheckedAt: "2026-09-28T10:00:00Z",
  lastCheckedAt: "2026-09-28T10:30:00Z",
  attempts: 2,
  lastJobId: "job_gap",
  resolvedAt: null,
  status: "unavailable",
};
const meta: Meta<typeof UnavailableDataTable> = {
  title: "Trading/UnavailableDataTable",
  component: UnavailableDataTable,
  parameters: { layout: "padded" },
  args: {
    rows: [row],
    onRecheck: () => undefined,
    renderJobLink: (content, jobId) => (
      <a className="text-action-text hover:underline" href={`#${jobId}`}>
        {content}
      </a>
    ),
  },
};
export default meta;
type Story = StoryObj<typeof UnavailableDataTable>;
export const Default: Story = {};
export const Resolved: Story = {
  args: { rows: [{ ...row, resolvedAt: "2026-09-28T10:30:00Z", status: "resolved" }] },
};
export const Loading: Story = { args: { rows: [], loading: true } };
export const Empty: Story = { args: { rows: [] } };
export const Error: Story = { args: { rows: [], error: "Could not load unavailable dates" } };
export const Disabled: Story = { args: { onRecheck: undefined } };
