import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { ThemeToggle } from "./ThemeToggle";

describe("ThemeToggle", () => {
  beforeEach(() => {
    document.documentElement.dataset["theme"] = "dark";
    localStorage.clear();
  });

  it("flips document dataset theme and aria-label on click", () => {
    render(<ThemeToggle />);

    const button = screen.getByRole("button", {
      name: "Switch to light theme",
    });
    expect(button).toBeInTheDocument();

    fireEvent.click(button);
    expect(document.documentElement.dataset["theme"]).toBe("light");
    expect(button).toHaveAttribute("aria-label", "Switch to dark theme");

    fireEvent.click(button);
    expect(document.documentElement.dataset["theme"]).toBe("dark");
    expect(button).toHaveAttribute("aria-label", "Switch to light theme");
  });
});
