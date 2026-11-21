import { z } from "zod";
import { idSchema } from "./common";

/**
 * Everything the audit log records (ADR-008). Adding one means adding it here and calling
 * `AuditService.record` after the action succeeds. Never rename one: old rows keep the old name.
 */
export const AUDIT_ACTIONS = [
  "api_key.created",
  "api_key.revoked",
  "member.role_changed",
  "member.removed",
  "invitation.sent",
  "invitation.resent",
  "invitation.revoked",
  "invitation.accepted",
  "project.created",
  "project.updated",
  "project.deleted",
  "project.source_context_enabled",
  "project.source_context_disabled",
  "github.connected",
  "github.repo_selected",
  "github.disconnected",
  "organization.renamed",
] as const;
export type AuditAction = (typeof AUDIT_ACTIONS)[number];

export const AUDIT_TARGET_TYPES = [
  "api_key",
  "member",
  "invitation",
  "project",
  "organization",
] as const;
export type AuditTargetType = (typeof AUDIT_TARGET_TYPES)[number];

/**
 * Small facts that make an entry readable after the target is gone: names, old and new role.
 * Flat and short on purpose. Never a key, a token, a request body or anything secret.
 */
export type AuditMetadata = Record<string, string | number | boolean | null>;

export const auditLogQuerySchema = z.object({
  /** The id of the last entry of the previous page (ids are UUIDv7, so time-ordered). */
  cursor: idSchema.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  action: z.enum(AUDIT_ACTIONS).optional(),
});
export type AuditLogQuery = z.infer<typeof auditLogQuerySchema>;

export interface PublicAuditEntry {
  id: string;
  action: AuditAction;
  /** Null when the user was deleted since. */
  actor: { id: string; name: string | null; email: string } | null;
  targetType: AuditTargetType;
  targetId: string | null;
  projectId: string | null;
  metadata: AuditMetadata;
  createdAt: string;
}
