import { z } from "zod";

export const ORG_ROLES = ["owner", "admin", "member"] as const;
export type OrgRole = (typeof ORG_ROLES)[number];

export const createOrganizationSchema = z.object({
  name: z.string().trim().min(2).max(80),
});

export const updateOrganizationSchema = z.object({
  name: z.string().trim().min(2).max(80),
});

/** The owner role can't be assigned here. */
export const updateMemberRoleSchema = z.object({
  role: z.enum(["admin", "member"]),
});

export type CreateOrganizationInput = z.infer<typeof createOrganizationSchema>;
export type UpdateOrganizationInput = z.infer<typeof updateOrganizationSchema>;
export type UpdateMemberRoleInput = z.infer<typeof updateMemberRoleSchema>;

export interface PublicOrganization {
  id: string;
  name: string;
  slug: string;
  /** The role of the current user in this organization. */
  role: OrgRole;
  createdAt: string;
}

export interface PublicMember {
  userId: string;
  email: string;
  name: string | null;
  role: OrgRole;
  joinedAt: string;
}
