import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AppShellContext } from "../AppShell/appShellContext";
import { NavItem } from "./NavItem";

describe("NavItem", () => {
  it("renders children and sets aria-current when active", () => {
    const { rerender } = render(<NavItem>Strategies</NavItem>);
    const button = screen.getByRole("button", { name: "Strategies" });
    expect(button).not.toHaveAttribute("aria-current");

    rerender(<NavItem active>Strategies</NavItem>);
    expect(button).toHaveAttribute("aria-current", "page");
  });

  it("calls onClick and closeMenu from context on click", () => {
    const onClick = vi.fn();
    const closeMenu = vi.fn();

    render(
      <AppShellContext.Provider value={{ closeMenu }}>
        <NavItem onClick={onClick}>Orders</NavItem>
      </AppShellContext.Provider>,
    );

    const button = screen.getByRole("button", { name: "Orders" });
    fireEvent.click(button);

    expect(onClick).toHaveBeenCalledTimes(1);
    expect(closeMenu).toHaveBeenCalledTimes(1);
  });

  it("works safely outside AppShell context without throwing", () => {
    const onClick = vi.fn();
    render(<NavItem onClick={onClick}>Standalone</NavItem>);

    const button = screen.getByRole("button", { name: "Standalone" });
    fireEvent.click(button);

    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
