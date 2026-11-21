import type {
  AuditAction,
  AuditMetadata,
  AuditTargetType,
  PublicAuditEntry,
} from '@errwise/shared';
import type { Prisma } from '@prisma/client';
import type { AuditRowWithActor } from './audit.repository';

export function toPublicAuditEntry(row: AuditRowWithActor): PublicAuditEntry {
  return {
    id: row.id,
    // Only AuditService writes rows, and it only takes AuditAction values.
    action: row.action as AuditAction,
    actor: row.actor,
    targetType: row.targetType as AuditTargetType,
    targetId: row.targetId,
    projectId: row.projectId,
    metadata: toMetadata(row.metadata),
    createdAt: row.createdAt.toISOString(),
  };
}

/** Keeps only flat, scalar values: whatever the column holds, the response stays small and safe. */
function toMetadata(value: Prisma.JsonValue): AuditMetadata {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return {};
  }
  const out: AuditMetadata = {};
  for (const [key, item] of Object.entries(value)) {
    if (
      item === null ||
      typeof item === 'string' ||
      typeof item === 'number' ||
      typeof item === 'boolean'
    ) {
      out[key] = item;
    }
  }
  return out;
}
