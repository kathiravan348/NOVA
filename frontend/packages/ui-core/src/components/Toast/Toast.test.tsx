import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ToastProvider } from "./ToastProvider";
import { useToast } from "./useToast";

function TestConsumer({
  title,
  description,
  tone,
}: {
  title: string;
  description?: string;
  tone?: "neutral" | "success" | "danger";
}) {
  const toast = useToast();
  return (
    <button type="button" onClick={() => toast.show({ title, description, tone })}>
      Trigger Toast
    </button>
  );
}

describe("Toast", () => {
  it("shows toast with title and description and closes when close button is clicked", () => {
    render(
      <ToastProvider>
        <TestConsumer
          title="Order Submitted"
          description="Position opened successfully"
          tone="success"
        />
      </ToastProvider>,
    );

    const trigger = screen.getByRole("button", { name: "Trigger Toast" });
    fireEvent.click(trigger);

    expect(screen.getByText("Order Submitted")).toBeInTheDocument();
    expect(screen.getByText("Position opened successfully")).toBeInTheDocument();

    const closeButton = screen.getByRole("button", { name: "Close toast" });
    fireEvent.click(closeButton);

    expect(screen.queryByText("Order Submitted")).not.toBeInTheDocument();
  });

  it("throws a clear error when useToast is used outside of ToastProvider", () => {
    const BadComponent = () => {
      useToast();
      return null;
    };

    expect(() => render(<BadComponent />)).toThrow("useToast must be used within a ToastProvider");
  });
});
