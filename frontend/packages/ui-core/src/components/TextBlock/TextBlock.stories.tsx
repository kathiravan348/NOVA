import type { Meta, StoryObj } from "@storybook/react-vite";
import { TextBlock } from "./TextBlock";

const meta: Meta<typeof TextBlock> = {
  title: "Core/TextBlock",
  component: TextBlock,
  args: { label: "Content", text: '{\n  "name": "Document export",\n  "format": "PDF"\n}' },
};
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
export const Empty: Story = { args: { text: "" } };
export const LongContent: Story = {
  args: {
    text: Array.from({ length: 60 }, (_, i) => `Line ${i + 1}: ${"content ".repeat(30)}`).join(
      "\n",
    ),
  },
};
