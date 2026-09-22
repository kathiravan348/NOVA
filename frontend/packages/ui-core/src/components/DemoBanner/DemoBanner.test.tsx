import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DemoBanner } from "./DemoBanner";

describe("DemoBanner", () => {
  it("renders role='note' and default disclaimer text", () => {
    render(<DemoBanner />);

    const banner = screen.getByRole("note");
    expect(banner).toBeInTheDocument();
    expect(screen.getByText("Demo data. Nothing on this screen is real.")).toBeInTheDocument();
  });

  it("renders custom disclaimer text when provided as children", () => {
    render(<DemoBanner>Custom simulation banner</DemoBanner>);

    expect(screen.getByText("Custom simulation banner")).toBeInTheDocument();
  });
});
