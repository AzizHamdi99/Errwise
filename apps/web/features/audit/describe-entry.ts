import type { AuditAction, PublicAuditEntry } from "@errwise/shared";

/** Short labels, used by the filter. Grouped in the order the filter shows them. */
export const AUDIT_ACTION_LABELS: Record<AuditAction, string> = {
  "api_key.created": "API key created",
  "api_key.revoked": "API key revoked",
  "member.role_changed": "Member role changed",
  "member.removed": "Member removed",
  "invitation.sent": "Invitation sent",
  "invitation.resent": "Invitation resent",
  "invitation.revoked": "Invitation revoked",
  "invitation.accepted": "Invitation accepted",
  "project.created": "Project created",
  "project.updated": "Project settings changed",
  "project.deleted": "Project deleted",
  "project.source_context_enabled": "Source code turned on",
  "project.source_context_disabled": "Source code turned off",
  "github.connected": "GitHub connected",
  "github.repo_selected": "GitHub repository selected",
  "github.disconnected": "GitHub disconnected",
  "organization.renamed": "Organization renamed",
};

const ROLE: Record<string, string> = {
  owner: "Owner",
  admin: "Admin",
  member: "Member",
};

function text(value: unknown): string | null {
  return typeof value === "string" && value ? value : null;
}

function role(value: unknown): string {
  const r = text(value);
  return r ? (ROLE[r] ?? r) : "unknown role";
}

/**
 * One plain sentence about what happened, built only from the entry's own metadata. Everything
 * here is rendered as text by React (never as HTML), so a name with markup stays harmless.
 * `projectName` comes from the live project list; a deleted project falls back to the name
 * stored in the entry, or to nothing.
 */
export function describeEntry(
  entry: PublicAuditEntry,
  projectName: string | null,
): string {
  const m = entry.metadata;
  const project = projectName ?? text(m.name) ?? "a project";
  const person = text(m.name) ?? text(m.email) ?? "a member";

  switch (entry.action) {
    case "api_key.created":
      return `Created API key "${text(m.name) ?? "unnamed"}" (${text(m.prefix) ?? "…"}) in ${projectName ?? "a project"}`;
    case "api_key.revoked":
      return `Revoked API key "${text(m.name) ?? "unnamed"}" (${text(m.prefix) ?? "…"}) in ${projectName ?? "a project"}`;
    case "member.role_changed":
      return `Changed ${person} from ${role(m.from)} to ${role(m.to)}`;
    case "member.removed":
      return m.left === true
        ? `Left the organization (${role(m.role)})`
        : `Removed ${person} (${role(m.role)})`;
    case "invitation.sent":
      return `Invited ${text(m.email) ?? "someone"} as ${role(m.role)}`;
    case "invitation.resent":
      return `Sent the invitation to ${text(m.email) ?? "someone"} again`;
    case "invitation.revoked":
      return `Cancelled the invitation to ${text(m.email) ?? "someone"}`;
    case "invitation.accepted":
      return `Joined as ${role(m.role)}`;
    case "project.created":
      return `Created project ${text(m.name) ?? project}`;
    case "project.updated":
      return text(m.previousName)
        ? `Renamed project ${text(m.previousName)} to ${text(m.name) ?? project}`
        : `Changed the settings of ${project} (${text(m.fields) ?? "settings"})`;
    case "project.deleted":
      return `Deleted project ${text(m.name) ?? "a project"}`;
    case "project.source_context_enabled":
      return `Turned source code on for ${project}`;
    case "project.source_context_disabled":
      return `Turned source code off for ${project}`;
    case "github.connected":
      return `Connected GitHub to ${projectName ?? "a project"}`;
    case "github.repo_selected":
      return `Linked ${projectName ?? "a project"} to ${text(m.repo) ?? "a repository"}`;
    case "github.disconnected":
      return `Disconnected GitHub from ${projectName ?? "a project"}`;
    case "organization.renamed":
      return `Renamed the organization from ${text(m.from) ?? "?"} to ${text(m.to) ?? "?"}`;
    default:
      return AUDIT_ACTION_LABELS[entry.action] ?? entry.action;
  }
}
