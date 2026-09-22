import type { Meta, StoryObj } from "@storybook/react-vite";
import { Field } from "./Field";

const meta: Meta<typeof Field> = {
  title: "Core/Field",
  component: Field,
  parameters: {
    layout: "padded",
  },
};

export default meta;
type Story = StoryObj<typeof Field>;

export const Default: Story = {
  args: {
    label: "Custom Control",
    htmlFor: "custom-input",
    children: (
      <input
        id="custom-input"
        className="h-10 px-3 rounded-md border border-border-strong bg-bg-surface text-text-primary"
      />
    ),
  },
};

export const WithDescription: Story = {
  args: {
    label: "Custom Control",
    htmlFor: "custom-input-desc",
    description: "This is a helper description for the field.",
    children: (
      <input
        id="custom-input-desc"
        className="h-10 px-3 rounded-md border border-border-strong bg-bg-surface text-text-primary"
      />
    ),
  },
};

export const Error: Story = {
  args: {
    label: "Custom Control",
    htmlFor: "custom-input-error",
    error: "This field is required",
    children: (
      <input
        id="custom-input-error"
        aria-invalid="true"
        className="h-10 px-3 rounded-md border border-loss bg-bg-surface text-text-primary"
      />
    ),
  },
};
