import { z } from "zod";
import type { OrgRole } from "./organizations";

const email = z.string().trim().toLowerCase().email().max(254);

export const createInvitationSchema = z.object({
  email,
  role: z.enum(["admin", "member"]).default("member"),
});

export const invitationTokenSchema = z.object({
  token: z.string().min(20).max(200),
});

export type CreateInvitationInput = z.infer<typeof createInvitationSchema>;
export type InvitationTokenInput = z.infer<typeof invitationTokenSchema>;

export interface PublicInvitation {
  id: string;
  email: string;
  role: OrgRole;
  invitedBy: string | null;
  expiresAt: string;
  createdAt: string;
}

export interface InvitationPreview {
  organizationName: string;
  email: string;
  role: OrgRole;
  inviterName: string | null;
  expiresAt: string;
}
