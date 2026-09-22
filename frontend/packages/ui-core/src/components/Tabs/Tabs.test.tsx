import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Tabs } from "./Tabs";

describe("Tabs", () => {
  const items = [
    { value: "first", label: "First Tab", content: <div>First Content</div> },
    { value: "second", label: "Second Tab", content: <div>Second Content</div> },
    {
      value: "third",
      label: "Third Tab",
      content: <div>Third Content</div>,
      disabled: true,
    },
    { value: "fourth", label: "Fourth Tab", content: <div>Fourth Content</div> },
  ];

  it("renders default first tab content and clicking second tab switches panel", () => {
    render(<Tabs ariaLabel="Test Tabs" items={items} />);

    expect(screen.getByText("First Content")).toBeVisible();
    expect(screen.queryByText("Second Content")).not.toBeInTheDocument();

    const secondTab = screen.getByRole("tab", { name: "Second Tab" });
    fireEvent.mouseDown(secondTab, { button: 0 });

    expect(screen.getByText("Second Content")).toBeInTheDocument();
    expect(screen.queryByText("First Content")).not.toBeInTheDocument();
  });

  it("skips disabled tab when navigating with arrow keys", async () => {
    render(<Tabs ariaLabel="Arrow Tabs" items={items} />);

    const firstTab = screen.getByRole("tab", { name: "First Tab" });
    const secondTab = screen.getByRole("tab", { name: "Second Tab" });
    const fourthTab = screen.getByRole("tab", { name: "Fourth Tab" });

    firstTab.focus();

    // ArrowRight to second tab
    fireEvent.keyDown(firstTab, { key: "ArrowRight" });
    await waitFor(() => {
      expect(secondTab).toHaveFocus();
    });

    // ArrowRight skips third (disabled) tab and focuses fourth tab
    fireEvent.keyDown(secondTab, { key: "ArrowRight" });
    await waitFor(() => {
      expect(fourthTab).toHaveFocus();
    });
  });
});
