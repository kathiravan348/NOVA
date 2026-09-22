import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Field } from "./Field";

describe("Field", () => {
  it("renders label linked to input via htmlFor", () => {
    render(
      <Field label="Username" htmlFor="user-input">
        <input id="user-input" />
      </Field>,
    );
    expect(screen.getByLabelText("Username")).toBeInTheDocument();
  });

  it("renders description with linked id", () => {
    render(
      <Field label="Username" htmlFor="user-input" description="Enter your account username">
        <input id="user-input" aria-describedby="user-input-description" />
      </Field>,
    );
    const desc = screen.getByText("Enter your account username");
    expect(desc).toBeInTheDocument();
    expect(desc).toHaveAttribute("id", "user-input-description");
  });

  it("renders error message with linked id and alert role", () => {
    render(
      <Field label="Username" htmlFor="user-input" error="Username is required">
        <input id="user-input" aria-describedby="user-input-error" />
      </Field>,
    );
    const err = screen.getByRole("alert");
    expect(err).toBeInTheDocument();
    expect(err).toHaveTextContent("Username is required");
    expect(err).toHaveAttribute("id", "user-input-error");
  });
});
