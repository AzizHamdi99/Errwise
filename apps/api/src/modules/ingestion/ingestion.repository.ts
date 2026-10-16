import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';

export interface StoreEventData {
  projectId: string;
  fingerprint: string;
  fingerprintVersion: number;
  title: string;
  eventId: string;
  level: string;
  type: string;
  message: string;
  stack?: string;
  platform: string;
  environment: string;
  release?: string;
  sdk?: string;
  context?: Prisma.InputJsonObject;
  timestamp: Date;
}

/** For a unique violation (P2002), returns the constraint info as text. */
function conflictInfo(error: unknown): string | null {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002'
  ) {
    return JSON.stringify(error.meta ?? {});
  }
  return null;
}

@Injectable()
export class IngestionRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Stores the event and updates its issue in one transaction.
   * Returns false if the eventId was already stored (idempotency):
   * the transaction rolls back, so the counter is not incremented.
   */
  async store(data: StoreEventData): Promise<boolean> {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        await this.storeOnce(data);
        return true;
      } catch (e) {
        const conflict = conflictInfo(e);
        if (conflict?.includes('eventId')) return false;
        // Two first events of the same error arrived together: retry once,
        // the issue exists now, so the upsert updates it.
        if (conflict?.includes('fingerprint') && attempt === 0) continue;
        throw e;
      }
    }
    throw new Error('Unreachable');
  }

  private storeOnce(data: StoreEventData): Promise<void> {
    return this.prisma.$transaction(async (tx) => {
      const issue = await tx.issue.upsert({
        where: {
          projectId_fingerprint: {
            projectId: data.projectId,
            fingerprint: data.fingerprint,
          },
        },
        create: {
          projectId: data.projectId,
          fingerprint: data.fingerprint,
          fingerprintVersion: data.fingerprintVersion,
          title: data.title,
          type: data.type,
          level: data.level,
          eventCount: 1,
          firstSeenAt: data.timestamp,
          lastSeenAt: data.timestamp,
          firstRelease: data.release,
          lastRelease: data.release,
        },
        update: { eventCount: { increment: 1 } },
      });

      // eventCount 1 means the upsert just created the issue.
      if (issue.eventCount > 1) {
        if (data.timestamp > issue.lastSeenAt) {
          await tx.issue.updateMany({
            where: { id: issue.id, lastSeenAt: { lt: data.timestamp } },
            data: { lastSeenAt: data.timestamp, lastRelease: data.release },
          });
        }
        // Regression: a resolved issue that fails again is reopened.
        // An ignored issue stays ignored.
        if (issue.status === 'resolved') {
          await tx.issue.updateMany({
            where: { id: issue.id, status: 'resolved' },
            data: { status: 'unresolved', resolvedAt: null },
          });
        }
      }

      await tx.event.create({
        data: {
          eventId: data.eventId,
          projectId: data.projectId,
          issueId: issue.id,
          level: data.level,
          type: data.type,
          message: data.message,
          stack: data.stack,
          platform: data.platform,
          environment: data.environment,
          release: data.release,
          sdk: data.sdk,
          context: data.context,
          timestamp: data.timestamp,
        },
      });
    });
  }
}
