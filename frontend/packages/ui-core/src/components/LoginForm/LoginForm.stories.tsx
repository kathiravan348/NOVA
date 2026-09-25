import * as React from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { LoginForm } from "./LoginForm";

const meta: Meta<typeof LoginForm> = {
  title: "Core/LoginForm",
  component: LoginForm,
  parameters: {
    layout: "centered",
  },
  args: {
    title: "Sign in",
    subtitle: "Strategy builder and backtesting",
    hint: "Demo mode: any username and password work.",
    onSubmit: () => undefined,
  },
};

export default meta;
type Story = StoryObj<typeof LoginForm>;

export const Default: Story = {};

export const WithError: Story = {
  args: { error: "Enter a username and password." },
};

export const Submitting: Story = {
  args: { submitting: true },
};

export const Narrow: Story = {
  globals: { viewport: { value: "mobile", isRotated: false } },
  render: (args) => (
    <div className="px-4">
      <LoginForm {...args} />
    </div>
  ),
};

/** Real sign-in (Stage B): the first field is an email address and there is no demo hint. */
export const EmailSignIn: Story = {
  args: { identifierLabel: "Email", identifierType: "email", hint: undefined },
};
