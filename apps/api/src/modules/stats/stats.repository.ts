import { Injectable } from '@nestjs/common';
import type { Issue } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import type { BucketUnit, LevelCountRow, ProjectCountRow } from './stats-range';

export type IssueWithProject = Issue & {
  project: { id: string; name: string };
};

export interface ProjectEventCount {
  projectId: string;
  count: number;
}

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

  // ---- Organization scope ----
  // These take the organization id and filter through the project relation, so a
  // soft-deleted project drops out of every number and nothing needs an id list.

  countEventsInOrg(organizationId: string, span: TimeSpan): Promise<number> {
    return this.prisma.event.count({
      where: {
        project: activeProjectOf(organizationId),
        timestamp: { gte: span.from, lt: span.to },
      },
    });
  }

  countUnresolvedIssuesInOrg(organizationId: string): Promise<number> {
    return this.prisma.issue.count({
      where: {
        project: activeProjectOf(organizationId),
        status: 'unresolved',
      },
    });
  }

  countNewIssuesInOrg(organizationId: string, span: TimeSpan): Promise<number> {
    return this.prisma.issue.count({
      where: {
        project: activeProjectOf(organizationId),
        firstSeenAt: { gte: span.from, lt: span.to },
      },
    });
  }

  countRegressedIssuesInOrg(
    organizationId: string,
    span: TimeSpan,
  ): Promise<number> {
    return this.prisma.issue.count({
      where: {
        project: activeProjectOf(organizationId),
        lastRegressionAt: { gte: span.from, lt: span.to },
      },
    });
  }

  /** Sparse rows, like eventsByBucketAndLevel, but split by project. */
  async eventsByBucketAndProject(
    organizationId: string,
    span: TimeSpan,
    unit: BucketUnit,
  ): Promise<ProjectCountRow[]> {
    const rows = await this.prisma.$queryRaw<
      { bucket: Date; projectId: string; count: bigint }[]
    >`
      SELECT date_trunc(${unit}, e."timestamp", 'UTC') AS bucket,
             e."projectId" AS "projectId",
             COUNT(*) AS count
      FROM "Event" e
      JOIN "Project" p ON p."id" = e."projectId"
      WHERE p."organizationId" = ${organizationId}::uuid
        AND p."deletedAt" IS NULL
        AND e."timestamp" >= ${span.from}
        AND e."timestamp" < ${span.to}
      GROUP BY 1, 2
    `;
    return rows.map((row) => ({ ...row, count: Number(row.count) }));
  }

  async eventCountsByProject(
    organizationId: string,
    span: TimeSpan,
  ): Promise<ProjectEventCount[]> {
    const rows = await this.prisma.event.groupBy({
      by: ['projectId'],
      where: {
        project: activeProjectOf(organizationId),
        timestamp: { gte: span.from, lt: span.to },
      },
      _count: { _all: true },
    });
    return rows.map((row) => ({
      projectId: row.projectId,
      count: row._count._all,
    }));
  }

  async unresolvedCountsByProject(
    organizationId: string,
  ): Promise<ProjectEventCount[]> {
    const rows = await this.prisma.issue.groupBy({
      by: ['projectId'],
      where: { project: activeProjectOf(organizationId), status: 'unresolved' },
      _count: { _all: true },
    });
    return rows.map((row) => ({
      projectId: row.projectId,
      count: row._count._all,
    }));
  }

  async topIssueCountsInOrg(
    organizationId: string,
    span: TimeSpan,
  ): Promise<TopIssueCount[]> {
    const rows = await this.prisma.event.groupBy({
      by: ['issueId'],
      where: {
        project: activeProjectOf(organizationId),
        timestamp: { gte: span.from, lt: span.to },
      },
      _count: { _all: true },
      orderBy: { _count: { issueId: 'desc' } },
      take: TOP_LIMIT,
    });
    return rows.map((row) => ({
      issueId: row.issueId,
      count: row._count._all,
    }));
  }

  /** Scoped by organization as well as the ids: an id from another tenant finds nothing. */
  findIssuesInOrg(
    organizationId: string,
    ids: string[],
  ): Promise<IssueWithProject[]> {
    if (ids.length === 0) return Promise.resolve([]);
    return this.prisma.issue.findMany({
      where: { id: { in: ids }, project: activeProjectOf(organizationId) },
      include: { project: { select: { id: true, name: true } } },
    });
  }
}

const activeProjectOf = (organizationId: string) => ({
  organizationId,
  deletedAt: null,
});
