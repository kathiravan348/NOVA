import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DateTimePicker } from "./DateTimePicker";

describe("DateTimePicker", () => {
  it("renders with label linked to input", () => {
    render(<DateTimePicker label="Start Time" />);
    const picker = screen.getByLabelText("Start Time");
    expect(picker).toBeInTheDocument();
    expect(picker).toHaveAttribute("type", "datetime-local");
  });

  it("converts UTC ISO to IST in datetime mode", () => {
    render(<DateTimePicker label="Start Time" value="2026-09-21T06:30:00Z" />);
    const picker = screen.getByLabelText("Start Time") as HTMLInputElement;
    expect(picker.value).toBe("2026-09-21T12:00");
    expect(screen.getByText("IST")).toBeInTheDocument();
  });

  it("converts IST input to UTC in onChange", () => {
    const handleChange = vi.fn();
    render(<DateTimePicker label="Start Time" onChange={handleChange} />);
    const picker = screen.getByLabelText("Start Time");
    fireEvent.change(picker, { target: { value: "2026-09-21T12:00" } });
    expect(handleChange).toHaveBeenCalledWith("2026-09-21T06:30:00Z");
  });

  it("calls onChange with null when cleared", () => {
    const handleChange = vi.fn();
    render(
      <DateTimePicker
        label="Start Time"
        defaultValue="2026-09-21T06:30:00Z"
        onChange={handleChange}
      />,
    );
    const picker = screen.getByLabelText("Start Time");
    fireEvent.change(picker, { target: { value: "" } });
    expect(handleChange).toHaveBeenCalledWith(null);
  });

  it("renders in date mode without conversion or timeZoneLabel suffix", () => {
    const handleChange = vi.fn();
    render(
      <DateTimePicker label="Trade Date" mode="date" value="2026-09-21" onChange={handleChange} />,
    );
    const picker = screen.getByLabelText("Trade Date") as HTMLInputElement;
    expect(picker).toHaveAttribute("type", "date");
    expect(picker.value).toBe("2026-09-21");
    expect(screen.queryByText("IST")).not.toBeInTheDocument();

    fireEvent.change(picker, { target: { value: "2026-09-22" } });
    expect(handleChange).toHaveBeenCalledWith("2026-09-22");
  });

  it("sets aria-invalid and shows error when error is provided", () => {
    render(<DateTimePicker label="Event Time" id="event-time" error="Date is out of range" />);
    const picker = screen.getByLabelText("Event Time");
    expect(picker).toHaveAttribute("aria-invalid", "true");
    expect(picker).toHaveAttribute("aria-describedby", "event-time-zone event-time-error");

    const err = screen.getByRole("alert");
    expect(err).toHaveTextContent("Date is out of range");
  });

  it("handles disabled state", () => {
    render(<DateTimePicker label="Locked time" disabled />);
    const picker = screen.getByLabelText("Locked time");
    expect(picker).toBeDisabled();
  });

  it("announces the time zone label to screen readers", () => {
    render(<DateTimePicker id="start" label="Start" />);
    expect(screen.getByLabelText("Start")).toHaveAttribute("aria-describedby", "start-zone");
    expect(screen.getByText("IST")).toHaveAttribute("id", "start-zone");
  });
});
