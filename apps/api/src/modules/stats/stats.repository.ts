import { Injectable } from '@nestjs/common';
import type { Issue } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import type { BucketUnit, LevelCountRow } from './stats-range';

export interface TimeSpan {
  from: Date;
  to: Date;
}

export interface TopIssueCount {
  issueId: string;
  count: number;
}

export interface EnvironmentRow {
  environment: string;
  count: number;
}

const TOP_LIMIT = 10;

// Every query takes projectId first and a [from, to) span, so it stays on the
// (projectId, timestamp) index and can never read another project's events.
@Injectable()
export class StatsRepository {
  constructor(private readonly prisma: PrismaService) {}

  countEvents(projectId: string, span: TimeSpan): Promise<number> {
    return this.prisma.event.count({
      where: { projectId, timestamp: { gte: span.from, lt: span.to } },
    });
  }

  countUnresolvedIssues(projectId: string): Promise<number> {
    return this.prisma.issue.count({
      where: { projectId, status: 'unresolved' },
    });
  }

  countNewIssues(projectId: string, span: TimeSpan): Promise<number> {
    return this.prisma.issue.count({
      where: { projectId, firstSeenAt: { gte: span.from, lt: span.to } },
    });
  }

  countRegressedIssues(projectId: string, span: TimeSpan): Promise<number> {
    return this.prisma.issue.count({
      where: { projectId, lastRegressionAt: { gte: span.from, lt: span.to } },
    });
  }

  /**
   * Sparse rows (only buckets that have events). The unit is bound as a parameter
   * from a closed union, and date_trunc runs in UTC whatever the session time zone is.
   */
  async eventsByBucketAndLevel(
    projectId: string,
    span: TimeSpan,
    unit: BucketUnit,
  ): Promise<LevelCountRow[]> {
    const rows = await this.prisma.$queryRaw<
      { bucket: Date; level: string; count: bigint }[]
    >`
      SELECT date_trunc(${unit}, "timestamp", 'UTC') AS bucket,
             "level" AS level,
             COUNT(*) AS count
      FROM "Event"
      WHERE "projectId" = ${projectId}::uuid
        AND "timestamp" >= ${span.from}
        AND "timestamp" < ${span.to}
      GROUP BY 1, 2
    `;
    return rows.map((row) => ({ ...row, count: Number(row.count) }));
  }

  async eventsByEnvironment(
    projectId: string,
    span: TimeSpan,
  ): Promise<EnvironmentRow[]> {
    const rows = await this.prisma.event.groupBy({
      by: ['environment'],
      where: { projectId, timestamp: { gte: span.from, lt: span.to } },
      _count: { _all: true },
      orderBy: { _count: { environment: 'desc' } },
      take: TOP_LIMIT,
    });
    return rows.map((row) => ({
      environment: row.environment,
      count: row._count._all,
    }));
  }

  async topIssueCounts(
    projectId: string,
    span: TimeSpan,
  ): Promise<TopIssueCount[]> {
    const rows = await this.prisma.event.groupBy({
      by: ['issueId'],
      where: { projectId, timestamp: { gte: span.from, lt: span.to } },
      _count: { _all: true },
      orderBy: { _count: { issueId: 'desc' } },
      take: TOP_LIMIT,
    });
    return rows.map((row) => ({
      issueId: row.issueId,
      count: row._count._all,
    }));
  }

  /** Scoped by projectId as well as the ids: an id from elsewhere finds nothing. */
  findIssues(projectId: string, ids: string[]): Promise<Issue[]> {
    if (ids.length === 0) return Promise.resolve([]);
    return this.prisma.issue.findMany({
      where: { projectId, id: { in: ids } },
    });
  }
}
