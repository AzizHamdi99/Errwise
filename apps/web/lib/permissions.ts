import type { OrgRole } from "@errwise/shared";

const RULES = {
  "org.rename": ["owner", "admin"],
  "org.delete": ["owner"],
  "project.write": ["owner"],
  "apiKey.write": ["owner"],
  "invitation.manage": ["owner", "admin"],
  "member.changeRole": ["owner"],
  "member.remove": ["owner", "admin"],
} as const satisfies Record<string, readonly OrgRole[]>;

export type Action = keyof typeof RULES;
export type InvitableRole = "admin" | "member";

export const ROLE_LABELS: Record<OrgRole, string> = {
  owner: "Owner",
  admin: "Admin",
  member: "Member",
};

/** Mirrors the API rules. The UI only guides: the API is the real security. */
export function can(role: OrgRole, action: Action): boolean {
  return (RULES[action] as readonly OrgRole[]).includes(role);
}

/** The roles this role is allowed to give when inviting. */
export function invitableRoles(role: OrgRole): InvitableRole[] {
  if (role === "owner") return ["admin", "member"];
  if (role === "admin") return ["member"];
  return [];
}

/** Admins can only manage invitations for the member role. */
export function canManageInvitation(
  actor: OrgRole,
  invitedRole: OrgRole,
): boolean {
  return (invitableRoles(actor) as OrgRole[]).includes(invitedRole);
}

/** Removing someone else. Leaving is a separate action, and the owner can never be removed. */
export function canRemoveMember(actor: OrgRole, target: OrgRole): boolean {
  if (target === "owner") return false;
  if (actor === "owner") return true;
  return actor === "admin" && target === "member";
}
