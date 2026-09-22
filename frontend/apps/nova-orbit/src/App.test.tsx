import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { brand } from "@nova/brand";
import { App } from "./App";

describe("NOVA Orbit smoke test", () => {
  it("renders the heading with the product name", () => {
    render(<App />);
    const heading = screen.getByRole("heading", { level: 1 });
    expect(heading).toBeInTheDocument();
    expect(heading.textContent).toBe(brand.products.orbit.name);
  });
});
