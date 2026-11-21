import { Injectable, Logger } from '@nestjs/common';
import type {
  AuditAction,
  AuditLogQuery,
  AuditMetadata,
  AuditTargetType,
  Paginated,
  PublicAuditEntry,
} from '@errwise/shared';
import { toPublicAuditEntry } from './audit.mapper';
import { AuditRepository } from './audit.repository';

const MAX_METADATA_KEYS = 10;
const MAX_METADATA_STRING = 200;

export interface AuditEntry {
  organizationId: string;
  /** The user who did it. Null only when no user is behind the action. */
  actorId: string | null;
  action: AuditAction;
  targetType: AuditTargetType;
  targetId?: string | null;
  projectId?: string | null;
  /** Names and roles that keep the entry readable later. Never a secret. */
  metadata?: AuditMetadata;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly repo: AuditRepository) {}

  /**
   * Called after the action succeeded. Best effort (ADR-008): it never throws, so a failed write
   * never fails the action the user already completed. It logs the action name only, never the
   * metadata.
   */
  async record(entry: AuditEntry): Promise<void> {
    try {
      await this.repo.create({
        organizationId: entry.organizationId,
        actorId: entry.actorId,
        action: entry.action,
        targetType: entry.targetType,
        targetId: entry.targetId ?? null,
        projectId: entry.projectId ?? null,
        metadata: capMetadata(entry.metadata ?? {}),
      });
    } catch {
      this.logger.error(`Could not write audit entry ${entry.action}`);
    }
  }

  async list(
    organizationId: string,
    query: AuditLogQuery,
  ): Promise<Paginated<PublicAuditEntry>> {
    // One extra row tells whether there is a next page without a count query.
    const rows = await this.repo.list(organizationId, {
      cursor: query.cursor,
      action: query.action,
      take: query.limit + 1,
    });
    const page = rows.slice(0, query.limit);
    return {
      items: page.map(toPublicAuditEntry),
      nextCursor:
        rows.length > query.limit ? (page[page.length - 1]?.id ?? null) : null,
    };
  }
}

/** Names come from users (a project name, an org name): cap them so a row stays small. */
function capMetadata(metadata: AuditMetadata): AuditMetadata {
  const out: AuditMetadata = {};
  for (const [key, value] of Object.entries(metadata).slice(
    0,
    MAX_METADATA_KEYS,
  )) {
    out[key] =
      typeof value === 'string' ? value.slice(0, MAX_METADATA_STRING) : value;
  }
  return out;
}
