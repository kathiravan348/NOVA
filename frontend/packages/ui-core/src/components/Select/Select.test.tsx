import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Select } from "./Select";

const testOptions = [
  { value: "opt1", label: "Option 1" },
  { value: "opt2", label: "Option 2" },
];

describe("Select", () => {
  it("renders with label linked to select element", () => {
    render(<Select label="Strategy Type" options={testOptions} />);
    const select = screen.getByLabelText("Strategy Type");
    expect(select).toBeInTheDocument();
    expect(screen.getByText("Option 1")).toBeInTheDocument();
    expect(screen.getByText("Option 2")).toBeInTheDocument();
  });

  it("renders placeholder option when provided", () => {
    render(<Select label="Strategy Type" placeholder="Choose type" options={testOptions} />);
    expect(screen.getByText("Choose type")).toBeInTheDocument();
  });

  it("sets aria-invalid and shows error when error is set", () => {
    render(
      <Select label="Type" id="select-type" options={testOptions} error="Selection is required" />,
    );
    const select = screen.getByLabelText("Type");
    expect(select).toHaveAttribute("aria-invalid", "true");
    expect(select).toHaveAttribute("aria-describedby", "select-type-error");

    const err = screen.getByRole("alert");
    expect(err).toHaveTextContent("Selection is required");
  });

  it("fires onChange event when selection changes", () => {
    const handleChange = vi.fn();
    render(
      <Select label="Type" options={testOptions} defaultValue="opt1" onChange={handleChange} />,
    );
    const select = screen.getByLabelText("Type");
    fireEvent.change(select, { target: { value: "opt2" } });
    expect(handleChange).toHaveBeenCalled();
    expect(select).toHaveValue("opt2");
  });

  it("handles disabled state", () => {
    render(<Select label="Disabled select" options={testOptions} disabled />);
    const select = screen.getByLabelText("Disabled select");
    expect(select).toBeDisabled();
  });

  it("does not set defaultValue when controlled with a placeholder", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    render(
      <Select
        label="Controlled"
        options={testOptions}
        placeholder="Pick one"
        value={testOptions[0]!.value}
        onChange={() => {}}
      />,
    );
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it("puts consecutive options of one group in an optgroup and keeps ungrouped ones flat", () => {
    const { container } = render(
      <Select
        label="Indicator"
        options={[
          { value: "none", label: "None" },
          { value: "sma", label: "SMA", group: "Trend" },
          { value: "ema", label: "EMA", group: "Trend" },
          { value: "rsi", label: "RSI", group: "Momentum" },
        ]}
      />,
    );
    const groups = container.querySelectorAll("optgroup");
    expect([...groups].map((g) => g.label)).toEqual(["Trend", "Momentum"]);
    expect(groups[0]!.querySelectorAll("option")).toHaveLength(2);
    expect(container.querySelector("select > option")).toHaveTextContent("None");
  });
});
