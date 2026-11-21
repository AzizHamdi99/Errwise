import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type { AuditAction } from '@errwise/shared';
import { PrismaService } from '../../database/prisma.service';

export interface AuditRowWithActor {
  id: string;
  organizationId: string;
  projectId: string | null;
  action: string;
  targetType: string;
  targetId: string | null;
  metadata: Prisma.JsonValue;
  createdAt: Date;
  actor: { id: string; name: string | null; email: string } | null;
}

export interface CreateAuditData {
  organizationId: string;
  projectId: string | null;
  actorId: string | null;
  action: AuditAction;
  targetType: string;
  targetId: string | null;
  metadata: Prisma.InputJsonObject;
}

export interface ListAuditOptions {
  /** Entries strictly older than this id (UUIDv7 ids are time-ordered). */
  cursor?: string;
  /** How many rows to read. The service asks for one more than it shows. */
  take: number;
  action?: AuditAction;
}

@Injectable()
export class AuditRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: CreateAuditData): Promise<void> {
    await this.prisma.auditLog.create({ data });
  }

  /**
   * Always scoped by organization. Newest first, on (organizationId, id DESC) or
   * (organizationId, action, id DESC): both are indexes.
   */
  list(
    organizationId: string,
    options: ListAuditOptions,
  ): Promise<AuditRowWithActor[]> {
    return this.prisma.auditLog.findMany({
      where: {
        organizationId,
        ...(options.action ? { action: options.action } : {}),
        ...(options.cursor ? { id: { lt: options.cursor } } : {}),
      },
      orderBy: { id: 'desc' },
      take: options.take,
      select: {
        id: true,
        organizationId: true,
        projectId: true,
        action: true,
        targetType: true,
        targetId: true,
        metadata: true,
        createdAt: true,
        actor: { select: { id: true, name: true, email: true } },
      },
    });
  }
}
