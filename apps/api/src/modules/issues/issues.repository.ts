import { Injectable } from '@nestjs/common';
import type { Event, Issue, Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import type { IssueCursor } from './issues.cursor';

export interface IssueFilter {
  status?: string;
  environment?: string;
  search?: string;
  cursor?: IssueCursor;
  limit: number;
}

@Injectable()
export class IssuesRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** Returns up to limit + 1 rows: the extra one tells the service there is a next page. */
  list(projectId: string, filter: IssueFilter): Promise<Issue[]> {
    const where: Prisma.IssueWhereInput = { projectId };

    if (filter.status) where.status = filter.status;
    if (filter.environment) {
      where.events = { some: { environment: filter.environment } };
    }
    if (filter.search) {
      where.title = { contains: filter.search, mode: 'insensitive' };
    }
    if (filter.cursor) {
      where.AND = [
        {
          OR: [
            { lastSeenAt: { lt: filter.cursor.lastSeenAt } },
            {
              lastSeenAt: filter.cursor.lastSeenAt,
              id: { lt: filter.cursor.id },
            },
          ],
        },
      ];
    }

    return this.prisma.issue.findMany({
      where,
      orderBy: [{ lastSeenAt: 'desc' }, { id: 'desc' }],
      take: filter.limit + 1,
    });
  }

  async environmentsByIssue(
    issueIds: string[],
  ): Promise<Map<string, string[]>> {
    const result = new Map<string, string[]>();
    if (issueIds.length === 0) return result;

    const rows = await this.prisma.event.groupBy({
      by: ['issueId', 'environment'],
      where: { issueId: { in: issueIds } },
    });
    for (const row of rows) {
      const list = result.get(row.issueId) ?? [];
      list.push(row.environment);
      result.set(row.issueId, list);
    }
    return result;
  }

  /** Scoped by project, so an id from another tenant returns null. */
  findInProject(projectId: string, id: string): Promise<Issue | null> {
    return this.prisma.issue.findFirst({ where: { id, projectId } });
  }

  recentEvents(issueId: string, limit: number): Promise<Event[]> {
    return this.prisma.event.findMany({
      where: { issueId },
      orderBy: [{ timestamp: 'desc' }, { id: 'desc' }],
      take: limit,
    });
  }

  updateStatus(id: string, status: string): Promise<Issue> {
    return this.prisma.issue.update({
      where: { id },
      data: {
        status,
        resolvedAt: status === 'resolved' ? new Date() : null,
      },
    });
  }
}
