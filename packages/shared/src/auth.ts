import { z } from "zod";

const email = z.string().trim().toLowerCase().email().max(254);

// bcrypt only uses the first 72 bytes, so we cap the length there
export const passwordSchema = z.string().min(8).max(72);

export const registerSchema = z.object({
  email,
  password: passwordSchema,
  name: z.string().trim().min(1).max(80).optional(),
});

export const loginSchema = z.object({
  email,
  password: z.string().min(1).max(72),
});

/** The link in the email carries a 32 byte random token (43 characters in base64url). */
export const verifyEmailSchema = z.object({
  token: z.string().trim().min(20).max(200),
});

export const resendVerificationSchema = z.object({ email });

export const forgotPasswordSchema = z.object({ email });

/** Same token format as the verification link. The new password follows the register rules. */
export const resetPasswordSchema = z.object({
  token: z.string().trim().min(20).max(200),
  password: passwordSchema,
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type VerifyEmailInput = z.infer<typeof verifyEmailSchema>;
export type ResendVerificationInput = z.infer<typeof resendVerificationSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

/** The `code` of the 403 that login answers when the email was never verified. */
export const EMAIL_NOT_VERIFIED = "EMAIL_NOT_VERIFIED";

/**
 * Registering does not sign anyone in: the account exists but cannot be used until the link in
 * the email is opened. `verificationEmailSent` is false when the email could not be sent; the
 * account is kept and the user can ask for another link.
 */
export interface RegisterResult {
  email: string;
  verificationEmailSent: boolean;
}

export interface PublicUser {
  id: string;
  email: string;
  name: string | null;
  createdAt: string;
  /** False for an account created with Google that never set a password. */
  hasPassword: boolean;
}
