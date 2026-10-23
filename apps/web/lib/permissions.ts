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

/** Mirrors the API rules. The UI only guides: the API is the real security. */
export function can(role: OrgRole, action: Action): boolean {
  return (RULES[action] as readonly OrgRole[]).includes(role);
}
