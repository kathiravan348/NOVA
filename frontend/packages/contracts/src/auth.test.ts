import { describe, expect, it } from "vitest";
import { LoginRequestSchema } from "./auth";

describe("LoginRequestSchema", () => {
  it("accepts an email and password", () => {
    const body = { email: "admin@example.com", password: "correct horse" };
    expect(LoginRequestSchema.safeParse(body).success).toBe(true);
  });

  it("rejects a bad email, an empty or huge password, and extra fields", () => {
    expect(LoginRequestSchema.safeParse({ email: "nope", password: "x" }).success).toBe(false);
    expect(LoginRequestSchema.safeParse({ email: "a@b.co", password: "" }).success).toBe(false);
    expect(
      LoginRequestSchema.safeParse({ email: "a@b.co", password: "x".repeat(201) }).success,
    ).toBe(false);
    expect(
      LoginRequestSchema.safeParse({ email: "a@b.co", password: "x", remember: true }).success,
    ).toBe(false);
  });
});
