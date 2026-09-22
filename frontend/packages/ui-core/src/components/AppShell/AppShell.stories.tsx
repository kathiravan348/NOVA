import * as React from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { Activity, BarChart3, Database, FileText, Layers, Settings } from "lucide-react";
import { Button } from "../Button/Button";
import { DemoBanner } from "../DemoBanner/DemoBanner";
import { NavItem } from "../NavItem/NavItem";
import { ThemeToggle } from "../ThemeToggle/ThemeToggle";
import { AppShell } from "./AppShell";

const meta: Meta<typeof AppShell> = {
  title: "Core/AppShell",
  component: AppShell,
  parameters: {
    layout: "fullscreen",
  },
};

export default meta;
type Story = StoryObj<typeof AppShell>;

const demoNav = (
  <>
    <NavItem icon={<BarChart3 className="h-4 w-4" />} active>
      Overview
    </NavItem>
    <NavItem icon={<Layers className="h-4 w-4" />}>Strategies</NavItem>
    <NavItem icon={<Activity className="h-4 w-4" />}>Backtests</NavItem>
    <NavItem icon={<Database className="h-4 w-4" />}>Data Feeds</NavItem>
    <NavItem icon={<FileText className="h-4 w-4" />}>Reports</NavItem>
    <NavItem icon={<Settings className="h-4 w-4" />}>Settings</NavItem>
  </>
);

const demoBrand = (
  <div className="flex items-center gap-2">
    <div className="h-7 w-7 rounded-md bg-action flex items-center justify-center font-bold text-white text-sm">
      P
    </div>
    <span className="font-semibold text-text-primary text-body">Platform</span>
  </div>
);

export const Default: Story = {
  render: () => (
    <AppShell
      brand={demoBrand}
      nav={demoNav}
      navFooter={<div className="text-body-sm text-text-muted">v0.1.0-prototype</div>}
      title="Overview"
      banner={<DemoBanner />}
      actions={
        <>
          <ThemeToggle />
          <Button variant="primary" size="sm">
            Action
          </Button>
        </>
      }
    >
      <div className="rounded-lg border border-border-default bg-bg-surface p-6">
        <h2 className="text-card-title font-semibold text-text-primary mb-2">Dashboard Content</h2>
        <p className="text-body text-text-secondary">
          Welcome to the prototype dashboard overview.
        </p>
      </div>
    </AppShell>
  ),
};

export const WithoutBanner: Story = {
  render: () => (
    <AppShell brand={demoBrand} nav={demoNav} title="Strategies" actions={<ThemeToggle />}>
      <div className="rounded-lg border border-border-default bg-bg-surface p-6">
        <h2 className="text-card-title font-semibold text-text-primary mb-2">Active Strategies</h2>
        <p className="text-body text-text-secondary">
          AppShell rendered without the top DemoBanner bar.
        </p>
      </div>
    </AppShell>
  ),
};

export const LongContent: Story = {
  render: () => (
    <AppShell
      brand={demoBrand}
      nav={demoNav}
      title="Long Document"
      banner={<DemoBanner />}
      actions={<ThemeToggle />}
    >
      <div className="space-y-6">
        {Array.from({ length: 15 }).map((_, i) => (
          <div key={i} className="rounded-lg border border-border-default bg-bg-surface p-6">
            <h3 className="font-semibold text-text-primary mb-2">Section {i + 1}</h3>
            <p className="text-body text-text-secondary">
              Scrollable content section testing sticky header and sidebar height behavior across
              viewport sizes.
            </p>
          </div>
        ))}
      </div>
    </AppShell>
  ),
};
