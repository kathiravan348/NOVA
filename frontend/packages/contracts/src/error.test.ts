import { describe, expect, it } from "vitest";
import { ApiErrorSchema } from "./error";

describe("ApiError contract", () => {
  it("validates a valid ApiError body", () => {
    const valid = {
      error: {
        code: "not_found",
        message: "Strategy strat-999 not found",
      },
    };
    expect(ApiErrorSchema.safeParse(valid).success).toBe(true);

    const internal = {
      error: {
        code: "internal",
        message: "Internal server error",
      },
    };
    expect(ApiErrorSchema.safeParse(internal).success).toBe(true);
  });

  it("fails for unknown code", () => {
    const unknownCode = {
      error: {
        code: "bad_request",
        message: "Bad request",
      },
    };
    expect(ApiErrorSchema.safeParse(unknownCode).success).toBe(false);
  });

  it("fails for extra keys", () => {
    const extraAtRoot = {
      error: {
        code: "not_found",
        message: "Not found",
      },
      extra: true,
    };
    expect(ApiErrorSchema.safeParse(extraAtRoot).success).toBe(false);

    const extraInError = {
      error: {
        code: "not_found",
        message: "Not found",
        extra: 123,
      },
    };
    expect(ApiErrorSchema.safeParse(extraInError).success).toBe(false);
  });

  it("fails for empty message", () => {
    const emptyMsg = {
      error: {
        code: "not_found",
        message: "",
      },
    };
    expect(ApiErrorSchema.safeParse(emptyMsg).success).toBe(false);
  });
});
