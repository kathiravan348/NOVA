import { z } from "zod";

/** `unauthorized` (401): no live session, or wrong email or password (D38). */
export const ApiErrorCodeSchema = z.enum([
  "not_found",
  "invalid_request",
  "unauthorized",
  "internal",
]);
export type ApiErrorCode = z.infer<typeof ApiErrorCodeSchema>;

export const ApiErrorSchema = z.strictObject({
  error: z.strictObject({
    code: ApiErrorCodeSchema,
    message: z.string().min(1),
  }),
});
export type ApiError = z.infer<typeof ApiErrorSchema>;
