import { composeStories } from "@storybook/react-vite";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeAll, describe, expect, it } from "vitest";
import * as stories from "./FormExample.stories";

beforeAll(() => {
  globalThis.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});

const { Example } = composeStories(stories);

describe("FormExample", () => {
  it("renders all six controls", () => {
    render(<Example />);

    expect(screen.getByLabelText("Strategy Name")).toBeInTheDocument();
    expect(screen.getByLabelText("Index Universe")).toBeInTheDocument();
    expect(screen.getByLabelText("Custom Execution Note")).toBeInTheDocument();
    expect(screen.getByLabelText("I accept algo execution risk disclaimer")).toBeInTheDocument();
    expect(screen.getByLabelText("Mandatory Auto-Square Off")).toBeInTheDocument();
    expect(screen.getByLabelText("Execution Start Time (IST)")).toBeInTheDocument();
  });

  it("submitting empty shows Zod validation messages under each field", async () => {
    render(<Example />);

    const submitBtn = screen.getByRole("button", { name: "Submit Strategy" });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText("Strategy name is required")).toBeInTheDocument();
      expect(screen.getByText("Universe is required")).toBeInTheDocument();
      expect(screen.getByText("Custom note is required")).toBeInTheDocument();
      expect(screen.getByText("Must accept terms")).toBeInTheDocument();
      expect(screen.getByText("Auto-square off must be enabled")).toBeInTheDocument();
      expect(screen.getByText("Start time is required")).toBeInTheDocument();
    });
  });
});
