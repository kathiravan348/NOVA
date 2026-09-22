import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { NavItem } from "../NavItem/NavItem";
import { AppShell } from "./AppShell";

describe("AppShell", () => {
  it("renders landmarks and skip link targeting #main-content", () => {
    render(
      <AppShell brand={<span>AppBrand</span>} nav={<NavItem>Dashboard</NavItem>} title="App Title">
        <div>Content Body</div>
      </AppShell>,
    );

    // Skip to content link
    const skipLink = screen.getByRole("link", { name: "Skip to content" });
    expect(skipLink).toBeInTheDocument();
    expect(skipLink).toHaveAttribute("href", "#main-content");

    // Landmarks: banner (header), navigation, main
    expect(screen.getByRole("banner")).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Main" })).toBeInTheDocument();
    expect(screen.getByRole("main")).toHaveAttribute("id", "main-content");
    expect(screen.getByText("Content Body")).toBeInTheDocument();
  });

  it("menu button opens dialog sheet and clicking a NavItem closes it", () => {
    render(
      <AppShell brand={<span>AppBrand</span>} nav={<NavItem>Strategies</NavItem>} title="App Title">
        <div>Content Body</div>
      </AppShell>,
    );

    const openMenuButton = screen.getByRole("button", { name: "Open menu" });
    expect(openMenuButton).toBeInTheDocument();

    // Dialog should not be open initially
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    // Click to open menu
    fireEvent.click(openMenuButton);

    const dialog = screen.getByRole("dialog");
    expect(dialog).toBeInTheDocument();

    // NavItem click inside dialog closes the menu
    const navItems = screen.getAllByRole("button", { name: "Strategies" });
    // One in desktop sidebar, one in mobile dialog sheet
    const dialogNavItem = navItems[navItems.length - 1]!;
    fireEvent.click(dialogNavItem);

    // Dialog is closed
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
