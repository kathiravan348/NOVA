import * as React from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { LayoutDashboard } from "lucide-react";
import { NavItem } from "./NavItem";

const meta: Meta<typeof NavItem> = {
  title: "Core/NavItem",
  component: NavItem,
  parameters: {
    layout: "padded",
  },
};

export default meta;
type Story = StoryObj<typeof NavItem>;

export const Default: Story = {
  render: () => (
    <div className="w-56">
      <NavItem>Dashboard</NavItem>
    </div>
  ),
};

export const Active: Story = {
  render: () => (
    <div className="w-56">
      <NavItem active>Dashboard</NavItem>
    </div>
  ),
};

export const WithIcon: Story = {
  render: () => (
    <div className="w-56 space-y-1">
      <NavItem icon={<LayoutDashboard className="h-4 w-4" />} active>
        Dashboard
      </NavItem>
      <NavItem icon={<LayoutDashboard className="h-4 w-4" />}>Analytics</NavItem>
    </div>
  ),
};
