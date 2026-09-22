import * as React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DescriptionList } from "./DescriptionList";

describe("DescriptionList", () => {
  it("renders label/value pairs as dt/dd", () => {
    const { container } = render(
      <DescriptionList
        items={[
          { label: "Segment", value: "Equity" },
          { label: "Qty", value: "50", numeric: true },
        ]}
      />,
    );
    expect(container.querySelectorAll("dt")).toHaveLength(2);
    expect(screen.getByText("Segment").tagName).toBe("DT");
    expect(screen.getByText("Equity").tagName).toBe("DD");
    expect(screen.getByText("50")).toHaveClass("font-mono");
  });

  it("uses two columns from md when asked", () => {
    const { container } = render(
      <DescriptionList columns={2} items={[{ label: "a", value: "b" }]} />,
    );
    expect(container.firstChild).toHaveClass("md:grid-cols-2");
  });
});
