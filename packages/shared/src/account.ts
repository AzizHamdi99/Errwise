import { z } from "zod";
import { passwordSchema } from "./auth";

export const updateProfileSchema = z.object({
  name: z.string().trim().min(1).max(80),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(72),
  newPassword: passwordSchema,
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

/**
 * One signed-in device: a refresh-token family. `id` is the family id. `userAgent` and `ip` are
 * shown only to the user they belong to. `lastUsedAt` is when the session last refreshed.
 */
export interface PublicSession {
  id: string;
  userAgent: string | null;
  ip: string | null;
  lastUsedAt: string;
  /** The session making this request. */
  current: boolean;
}
