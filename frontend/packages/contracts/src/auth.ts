import { z } from "zod";

/** Body of `POST /api/v1/auth/login` (D38). The response is the signed-in `User`. */
export const LoginRequestSchema = z.strictObject({
  email: z.email(),
  password: z.string().min(1).max(200),
});
export type LoginRequest = z.infer<typeof LoginRequestSchema>;
