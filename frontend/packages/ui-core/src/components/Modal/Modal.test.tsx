import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Modal } from "./Modal";

describe("Modal", () => {
  it("opens from trigger, shows title, and closes via close button", () => {
    render(
      <Modal
        trigger={<button type="button">Open</button>}
        title="Settings Dialog"
        description="Configure your preferences"
      >
        <p>Dialog body content</p>
      </Modal>,
    );

    const trigger = screen.getByRole("button", { name: "Open" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    fireEvent.click(trigger);

    const dialog = screen.getByRole("dialog");
    expect(dialog).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Settings Dialog" })).toBeInTheDocument();
    expect(screen.getByText("Configure your preferences")).toBeInTheDocument();
    expect(screen.getByText("Dialog body content")).toBeInTheDocument();

    const closeButton = screen.getByRole("button", { name: "Close" });
    fireEvent.click(closeButton);

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("closes when Esc key is pressed", () => {
    render(
      <Modal trigger={<button type="button">Open</button>} title="Esc Test Dialog">
        <p>Press escape</p>
      </Modal>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Open" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
