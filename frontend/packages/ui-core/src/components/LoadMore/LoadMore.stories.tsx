import type { Meta, StoryObj } from "@storybook/react-vite";
import { LoadMore } from "./LoadMore";

const meta: Meta<typeof LoadMore> = {
  title: "Core/LoadMore",
  component: LoadMore,
  parameters: { layout: "padded" },
  args: { hasMore: true, loading: false, onLoadMore: () => {} },
};

export default meta;
type Story = StoryObj<typeof LoadMore>;

export const Default: Story = {};

export const Loading: Story = { args: { loading: true } };

export const CustomLabel: Story = { args: { label: "Show older entries" } };

/** Loads by itself when scrolled into view (infinite scroll); the button stays as a fallback. */
export const Auto: Story = { args: { auto: true, label: "Load more trades" } };

/** Nothing renders once every page is loaded. */
export const NoMore: Story = { args: { hasMore: false } };
