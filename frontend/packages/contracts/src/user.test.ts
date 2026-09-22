import { describe, expect, it } from "vitest";
import { User, UserSchema } from "./user";

describe("UserSchema", () => {
  const validUser: User = {
    id: "usr-001",
    name: "Kathiravan Super Admin",
    email: "admin@nova.internal",
    role: "super_admin",
    createdAt: "2026-09-22T08:00:00Z",
    lastLoginAt: "2026-09-22T12:00:00Z",
  };

  it("accepts a valid user", () => {
    expect(UserSchema.safeParse(validUser).success).toBe(true);
  });

  it("accepts a user with null lastLoginAt", () => {
    expect(UserSchema.safeParse({ ...validUser, lastLoginAt: null }).success).toBe(true);
  });

  it("rejects an invalid role", () => {
    expect(UserSchema.safeParse({ ...validUser, role: "admin" }).success).toBe(false);
  });

  it("rejects an invalid email", () => {
    expect(UserSchema.safeParse({ ...validUser, email: "not-an-email" }).success).toBe(false);
  });

  it("rejects an empty name", () => {
    expect(UserSchema.safeParse({ ...validUser, name: "" }).success).toBe(false);
  });

  it("rejects extra keys due to strictObject", () => {
    expect(UserSchema.safeParse({ ...validUser, extraField: "disallowed" }).success).toBe(false);
  });
});
